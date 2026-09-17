import time
import uuid
from io import BytesIO

from pypdf import PdfReader
from sqlalchemy import delete, select

from app.core.logging import get_logger
from app.core.metrics import metrics
from app.db.session import SessionLocal
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.embeddings import embed_texts
from app.services.storage import read_file_bytes
from app.services.text_chunking import split_text


logger = get_logger(__name__)


def ingest_document(
    document_id: uuid.UUID,
) -> None:
    ingestion_start = time.perf_counter()

    db = SessionLocal()

    document = None

    page_count = 0
    chunk_count = 0

    extraction_duration_ms = 0.0
    embedding_duration_ms = 0.0

    try:
        # -------------------------------------------------
        # 1. Load document record
        # -------------------------------------------------

        document = db.scalar(
            select(Document).where(
                Document.id == document_id
            )
        )

        if document is None:
            logger.warning(
                "Document not found for ingestion",
                extra={
                    "event": (
                        "document_ingestion_skipped"
                    ),
                    "document_id": str(
                        document_id
                    ),
                    "status": "not_found",
                },
            )

            return

        # -------------------------------------------------
        # 2. Validate storage key
        # -------------------------------------------------

        if not document.storage_key:
            document.status = "failed"
            db.commit()

            metrics.record_ingestion_failed()

            logger.warning(
                "Document has no storage key",
                extra={
                    "event": (
                        "document_ingestion_failed"
                    ),
                    "document_id": str(
                        document.id
                    ),
                    "user_id": str(
                        document.user_id
                    ),
                    "status": (
                        "missing_storage_key"
                    ),
                },
            )

            return

        # -------------------------------------------------
        # 3. Mark document as processing
        # -------------------------------------------------

        document.status = "processing"
        db.commit()

        logger.info(
            "Document ingestion started",
            extra={
                "event": (
                    "document_ingestion_started"
                ),
                "document_id": str(
                    document.id
                ),
                "user_id": str(
                    document.user_id
                ),
                "status": "processing",
            },
        )

        # -------------------------------------------------
        # 4. Read document from configured storage backend
        # -------------------------------------------------

        try:
            pdf_bytes = read_file_bytes(
                document.storage_key
            )

        except FileNotFoundError:
            document.status = "failed"
            db.commit()

            metrics.record_ingestion_failed()

            ingestion_duration_ms = (
                time.perf_counter()
                - ingestion_start
            ) * 1000

            logger.warning(
                "Document file does not exist",
                extra={
                    "event": (
                        "document_ingestion_failed"
                    ),
                    "document_id": str(
                        document.id
                    ),
                    "user_id": str(
                        document.user_id
                    ),
                    "ingestion_duration_ms": round(
                        ingestion_duration_ms,
                        2,
                    ),
                    "status": "file_not_found",
                },
            )

            return

        # -------------------------------------------------
        # 5. Delete existing chunks
        # -------------------------------------------------

        db.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id
                == document.id
            )
        )

        db.commit()

        # -------------------------------------------------
        # 6. Extract PDF text and create chunks
        # -------------------------------------------------

        extraction_start = (
            time.perf_counter()
        )

        reader = PdfReader(
            BytesIO(pdf_bytes)
        )

        page_count = len(
            reader.pages
        )

        chunk_records: list[dict] = []

        chunk_index = 0

        for page_index, page in enumerate(
            reader.pages
        ):
            text = (
                page.extract_text()
                or ""
            )

            if not text.strip():
                continue

            page_chunks = split_text(
                text
            )

            for chunk in page_chunks:
                chunk_records.append(
                    {
                        "page_number": (
                            page_index + 1
                        ),
                        "chunk_index": (
                            chunk_index
                        ),
                        "content": chunk,
                    }
                )

                chunk_index += 1

        chunk_count = len(
            chunk_records
        )

        extraction_duration_ms = (
            time.perf_counter()
            - extraction_start
        ) * 1000

        # -------------------------------------------------
        # 7. Ensure content was extracted
        # -------------------------------------------------

        if not chunk_records:
            document.status = "failed"
            db.commit()

            metrics.record_ingestion_failed()

            ingestion_duration_ms = (
                time.perf_counter()
                - ingestion_start
            ) * 1000

            logger.warning(
                "Document contained no usable text",
                extra={
                    "event": (
                        "document_ingestion_failed"
                    ),
                    "document_id": str(
                        document.id
                    ),
                    "user_id": str(
                        document.user_id
                    ),
                    "page_count": (
                        page_count
                    ),
                    "chunk_count": 0,
                    "extraction_duration_ms": round(
                        extraction_duration_ms,
                        2,
                    ),
                    "embedding_duration_ms": 0.0,
                    "ingestion_duration_ms": round(
                        ingestion_duration_ms,
                        2,
                    ),
                    "status": (
                        "no_extractable_text"
                    ),
                },
            )

            return

        # -------------------------------------------------
        # 8. Generate embeddings
        # -------------------------------------------------

        texts = [
            record["content"]
            for record in chunk_records
        ]

        embedding_start = (
            time.perf_counter()
        )

        embeddings = embed_texts(
            texts
        )

        embedding_duration_ms = (
            time.perf_counter()
            - embedding_start
        ) * 1000

        # -------------------------------------------------
        # 9. Validate embedding count
        # -------------------------------------------------

        if len(embeddings) != len(
            chunk_records
        ):
            raise RuntimeError(
                "Embedding count does not match "
                "chunk count."
            )

        # -------------------------------------------------
        # 10. Store chunks and embeddings
        # -------------------------------------------------

        for record, embedding in zip(
            chunk_records,
            embeddings,
        ):
            document_chunk = (
                DocumentChunk(
                    document_id=(
                        document.id
                    ),
                    page_number=(
                        record[
                            "page_number"
                        ]
                    ),
                    chunk_index=(
                        record[
                            "chunk_index"
                        ]
                    ),
                    content=(
                        record[
                            "content"
                        ]
                    ),
                    embedding=embedding,
                )
            )

            db.add(
                document_chunk
            )

        # -------------------------------------------------
        # 11. Mark document ready
        # -------------------------------------------------

        document.status = "ready"

        db.commit()

        ingestion_duration_ms = (
            time.perf_counter()
            - ingestion_start
        ) * 1000

        metrics.record_ingestion_completed(
            ingestion_duration_ms
        )

        logger.info(
            "Document ingestion completed",
            extra={
                "event": (
                    "document_ingestion_completed"
                ),
                "document_id": str(
                    document.id
                ),
                "user_id": str(
                    document.user_id
                ),
                "page_count": (
                    page_count
                ),
                "chunk_count": (
                    chunk_count
                ),
                "extraction_duration_ms": round(
                    extraction_duration_ms,
                    2,
                ),
                "embedding_duration_ms": round(
                    embedding_duration_ms,
                    2,
                ),
                "ingestion_duration_ms": round(
                    ingestion_duration_ms,
                    2,
                ),
                "status": "ready",
            },
        )

    except Exception:
        db.rollback()

        ingestion_duration_ms = (
            time.perf_counter()
            - ingestion_start
        ) * 1000

        metrics.record_ingestion_failed()

        logger.exception(
            "Document ingestion failed",
            extra={
                "event": (
                    "document_ingestion_failed"
                ),
                "document_id": str(
                    document_id
                ),
                "user_id": (
                    str(
                        document.user_id
                    )
                    if document is not None
                    else None
                ),
                "page_count": (
                    page_count
                ),
                "chunk_count": (
                    chunk_count
                ),
                "extraction_duration_ms": round(
                    extraction_duration_ms,
                    2,
                ),
                "embedding_duration_ms": round(
                    embedding_duration_ms,
                    2,
                ),
                "ingestion_duration_ms": round(
                    ingestion_duration_ms,
                    2,
                ),
                "status": "failed",
            },
        )

        document = db.scalar(
            select(Document).where(
                Document.id == document_id
            )
        )

        if document:
            document.status = "failed"
            db.commit()

    finally:
        db.close()