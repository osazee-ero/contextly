"""Integration regressions using only the disposable local contextly_test DB.

Run from backend: python -m unittest discover -s tests -v
See docs/UPDATE.md for the Docker database command. Providers are mocked.
"""
import os
import subprocess
import sys
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

# Deliberately ignore production .env connection details.
os.environ.update({
    "DATABASE_URL": "postgresql+psycopg://contextly_test:contextly_test@127.0.0.1:55439/contextly_test",
    "OPENAI_API_KEY": "test-key", "CLERK_SECRET_KEY": "sk_test_placeholder",
    "CLERK_PUBLISHABLE_KEY": "pk_test_placeholder", "STORAGE_BACKEND": "local",
    "FRONTEND_URL": "http://localhost:3000", "ENVIRONMENT": "test",
})

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from sqlalchemy import func, select, text

from app.main import app, api
from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models import User, Document, Conversation, Message, DailyUsage, DocumentChunk
from app.services.auth import AuthenticatedUser, get_authenticated_user
from app.services.document_ingestion import ingest_document
from app.services.embeddings import embed_texts
from app.services.answer_generation import extract_citation_numbers
from app.services.usage import consume_question, refund_question


def pdf_bytes(text_value=None):
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    if text_value:
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"):
            DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 20 200 Td ({text_value}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@api.get("/__test_error")
def test_error_route():
    raise RuntimeError("Private provider details must not be returned")


class RegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        with SessionLocal() as db:
            db.execute(text("TRUNCATE users CASCADE"))
            user = User(clerk_user_id="user_test", email="test@example.test")
            db.add(user)
            db.commit()
            self.user_id = user.id
        api.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser("user_test")
        self.directory = tempfile.TemporaryDirectory()
        self.previous_storage = settings.storage_path
        settings.storage_path = self.directory.name
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()
        api.dependency_overrides.clear()
        settings.storage_path = self.previous_storage
        self.directory.cleanup()

    def upload(self, content=None):
        return self.client.post("/api/documents/upload", files={
            "file": ("sample.pdf", content or pdf_bytes(), "application/pdf"),
        })

    def test_concurrent_first_signup_requests_share_one_user(self):
        api.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser("user_new")
        barrier = Barrier(3)
        def clerk_get(**_kwargs):
            barrier.wait(timeout=10)
            return SimpleNamespace(primary_email_address_id="email", email_addresses=[
                SimpleNamespace(id="email", email_address="new@example.test")])
        clerk = SimpleNamespace(users=SimpleNamespace(get=clerk_get))
        with patch("app.services.current_user.clerk", clerk):
            with ThreadPoolExecutor(max_workers=3) as pool:
                responses = list(pool.map(self.client.get, ["/api/usage", "/api/documents", "/api/conversations"]))
        self.assertEqual([r.status_code for r in responses], [200, 200, 200])
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(User).where(User.clerk_user_id == "user_new")), 1)

    def test_reused_email_cannot_claim_another_identity(self):
        api.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser("user_other")
        clerk = SimpleNamespace(users=SimpleNamespace(get=lambda **_: SimpleNamespace(
            primary_email_address_id="email", email_addresses=[SimpleNamespace(id="email", email_address="test@example.test")]
        )))
        with patch("app.services.current_user.clerk", clerk):
            self.assertEqual(self.client.get("/api/documents").status_code, 409)
        with SessionLocal() as db:
            self.assertEqual(db.get(User, self.user_id).clerk_user_id, "user_test")

    def test_server_failure_remains_readable_through_cors(self):
        response = self.client.get("/__test_error", headers={"Origin": "http://localhost:3000"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")
        self.assertTrue(response.headers["x-request-id"])
        self.assertNotIn("Private provider", response.text)
        self.assertIn("try again", response.json()["detail"])

    def test_scanned_pdf_explains_missing_text(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.text)
        document = self.client.get("/api/documents").json()[0]
        self.assertEqual(document["status"], "failed")
        self.assertIn("OCR", document["error_message"])

    def test_embedding_failure_and_retry_reuse_the_file(self):
        with patch("app.services.document_ingestion.embed_texts", side_effect=RuntimeError("private provider message")):
            response = self.upload(pdf_bytes("Useful knowledge for testing"))
        self.assertEqual(response.status_code, 201)
        document_id = response.json()["id"]
        failed = self.client.get("/api/documents").json()[0]
        self.assertEqual(failed["status"], "failed")
        self.assertIn("indexing service", failed["error_message"])
        self.assertNotIn("private provider", failed["error_message"])
        with patch("app.services.document_ingestion.embed_texts", side_effect=lambda texts: [[0.1] * 1536 for _ in texts]):
            retried = self.client.post(f"/api/documents/{document_id}/retry")
        self.assertEqual(retried.status_code, 202, retried.text)
        ready = self.client.get("/api/documents").json()
        self.assertEqual(len(ready), 1)
        self.assertEqual(ready[0]["status"], "ready")
        self.assertIsNone(ready[0]["error_message"])
        self.assertEqual(self.client.post(f"/api/documents/{document_id}/retry").status_code, 409)

    def test_document_operations_are_owner_scoped(self):
        document_id = self.upload().json()["id"]
        with SessionLocal() as db:
            db.add(User(clerk_user_id="other", email="other@example.test"))
            db.commit()
        api.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser("other")
        self.assertEqual(self.client.get("/api/documents").json(), [])
        self.assertEqual(self.client.post(f"/api/documents/{document_id}/retry").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/documents/{document_id}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/documents/{document_id}/chunks").status_code, 404)

    def test_concurrent_uploads_do_not_exceed_quota(self):
        with SessionLocal() as db:
            db.add_all([Document(user_id=self.user_id, filename=f"{i}.pdf", status="failed", file_size_bytes=1) for i in range(9)])
            db.commit()
        with patch("app.api.routes.documents.ingest_document"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda _: self.upload(), range(2)))
        self.assertEqual(sorted(r.status_code for r in responses), [201, 409])

    def test_invalid_pdfs_return_explanations(self):
        for content, expected in [(b"not a PDF", "Invalid PDF"), (b"%PDF-" + b"x" * (10 * 1024 * 1024), "10 MB")]:
            response = self.upload(content)
            self.assertEqual(response.status_code, 400)
            self.assertIn(expected, response.json()["detail"])
        empty = PdfWriter()
        buffer = BytesIO()
        empty.write(buffer)
        self.assertIn("no pages", self.upload(buffer.getvalue()).json()["detail"])

    def test_chat_failure_refunds_quota_and_leaves_no_partial_messages(self):
        with patch("app.api.routes.chat.retrieve_chunks", side_effect=RuntimeError("provider down")):
            response = self.client.post("/api/chat", json={"question": "What are the requirements?"})
        self.assertEqual(response.status_code, 503)
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Conversation)), 0)
            self.assertEqual(db.scalar(select(func.count()).select_from(Message)), 0)
            self.assertEqual(db.scalar(select(DailyUsage.question_count)), 0)

    def test_inaccessible_conversation_does_not_consume_quota(self):
        response = self.client.post("/api/chat", json={"question": "Find my answer", "conversation_id": str(uuid.uuid4())})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get("/api/usage").json()["questions_used"], 0)

    def test_successful_answer_and_question_are_saved_together(self):
        from app.services.answer_generation import GeneratedAnswer, CitedSource
        from app.services.retrieval import RetrievalResult
        source = RetrievalResult(uuid.uuid4(), uuid.uuid4(), "manual.pdf", 1, "Four cores required", 0.1)
        answer = GeneratedAnswer("Four cores [1].", False, [CitedSource(1, source)])
        with patch("app.api.routes.chat.retrieve_chunks", return_value=[source]), patch("app.api.routes.chat.generate_answer", return_value=answer):
            response = self.client.post("/api/chat", json={"question": "How many cores?"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["citations"][0]["filename"], "manual.pdf")
        conversation = self.client.get(f'/api/conversations/{response.json()["conversation_id"]}').json()
        self.assertEqual([m["role"] for m in conversation["messages"]], ["user", "assistant"])
        self.assertEqual(self.client.get("/api/usage").json()["questions_used"], 1)

    def test_save_failure_rolls_back_and_refunds(self):
        with patch("app.api.routes.chat.retrieve_chunks", return_value=[]), patch("app.api.routes.chat.save_assistant_message", side_effect=RuntimeError("write failed")):
            response = self.client.post("/api/chat", json={"question": "A document question"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.client.get("/api/conversations").json(), [])
        self.assertEqual(self.client.get("/api/usage").json()["questions_used"], 0)

    def test_empty_knowledge_base_does_not_call_embedding_provider(self):
        with patch("app.services.retrieval.embed_text") as embed:
            response = self.client.post("/api/chat", json={"question": "What is in my documents?"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["insufficient_context"])
        embed.assert_not_called()

    def test_metrics_storage_is_bounded(self):
        from app.core.metrics import MetricsStore
        store = MetricsStore()
        for i in range(2000):
            store.record_http_request(float(i))
        self.assertEqual(store.http_requests, 2000)
        self.assertEqual(len(store.request_durations_ms), 1000)

    def test_refund_applies_to_reservation_day(self):
        yesterday = date.today() - timedelta(days=1)
        today = date.today()
        with SessionLocal() as db:
            consume_question(db, self.user_id, yesterday)
            consume_question(db, self.user_id, today)
            refund_question(db, self.user_id, yesterday)
            rows = {u.usage_date: u.question_count for u in db.scalars(select(DailyUsage))}
            self.assertEqual(rows, {yesterday: 0, today: 1})

    def test_embedding_batches_preserve_order(self):
        calls = []
        def create(**kwargs):
            batch = kwargs["input"]
            calls.append(len(batch))
            return SimpleNamespace(data=[SimpleNamespace(index=i, embedding=[float(value)]) for i, value in reversed(list(enumerate(batch)))])
        with patch("app.services.embeddings.client") as client:
            client.embeddings.create.side_effect = create
            result = embed_texts([str(i) for i in range(140)])
        self.assertEqual(calls, [64, 64, 12])
        self.assertEqual(result, [[float(i)] for i in range(140)])

    def test_grouped_citations_are_recognized(self):
        self.assertEqual(extract_citation_numbers("Supported [1, 2], also [ 3 ] and [1]."), [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
