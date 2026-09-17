import re
import time
import uuid

from datetime import (
    datetime,
    timezone,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger

from app.db.session import get_db

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    Citation,
)

from app.services.answer_generation import (
    generate_answer,
    GeneratedAnswer,
)

from app.services.current_user import (
    get_current_user,
)

from app.services.retrieval import (
    retrieve_chunks,
)

from app.services.usage import (
    QuestionLimitExceeded,
    consume_question,
    refund_question,
)
from app.core.metrics import metrics

logger = get_logger(__name__)

router = APIRouter()


def build_conversation_title(
    question: str,
) -> str:
    cleaned = " ".join(
        question.split()
    )

    if len(cleaned) <= 80:
        return cleaned

    return (
        cleaned[:77].rstrip()
        + "..."
    )


def normalize_message(
    message: str,
) -> str:
    normalized = (
        message
        .lower()
        .strip()
    )

    normalized = re.sub(
        r"[^\w\s]",
        "",
        normalized,
    )

    normalized = " ".join(
        normalized.split()
    )

    return normalized


def get_conversational_response(
    message: str,
) -> str | None:
    normalized = normalize_message(
        message
    )

    greetings = {
        "hi",
        "hello",
        "hey",
        "hi there",
        "hello there",
        "hey there",
        "good morning",
        "good afternoon",
        "good evening",
    }

    thanks = {
        "thanks",
        "thank you",
        "thank you so much",
        "thanks so much",
    }

    wellbeing = {
        "how are you",
        "how are you doing",
        "how is it going",
        "hows it going",
    }

    if normalized in greetings:
        return (
            "Hi! What would you like to know "
            "about your uploaded documents?"
        )

    if normalized in thanks:
        return (
            "You're welcome! Feel free to ask "
            "another question about your documents."
        )

    if normalized in wellbeing:
        return (
            "I'm doing well and ready to help. "
            "What would you like to know about "
            "your uploaded documents?"
        )

    return None


def get_user_conversation(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> Conversation:
    statement = (
        select(Conversation)
        .where(
            Conversation.id
            == conversation_id,
            Conversation.user_id
            == user_id,
        )
    )

    conversation = (
        db.execute(statement)
        .scalar_one_or_none()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conversation


def get_or_create_conversation(
    db: Session,
    user_id: uuid.UUID,
    question: str,
    conversation_id: uuid.UUID | None,
) -> Conversation:
    if conversation_id:
        return get_user_conversation(
            db=db,
            user_id=user_id,
            conversation_id=conversation_id,
        )

    conversation = Conversation(
        user_id=user_id,
        title=build_conversation_title(
            question
        ),
    )

    db.add(conversation)
    db.flush()

    return conversation


def save_user_message(
    db: Session,
    conversation: Conversation,
    question: str,
) -> None:
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        created_at=datetime.now(timezone.utc),
        content=question,
        citations=[],
        insufficient_context=False,
    )

    db.add(user_message)

    conversation.updated_at = (
        datetime.now(
            timezone.utc
        )
    )


def save_assistant_message(
    db: Session,
    conversation: Conversation,
    answer: str,
    citations: list[Citation],
    insufficient_context: bool,
) -> Message:
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        created_at=datetime.now(timezone.utc),
        content=answer,
        citations=[
            citation.model_dump(
                mode="json"
            )
            for citation in citations
        ],
        insufficient_context=(
            insufficient_context
        ),
    )

    db.add(assistant_message)

    conversation.updated_at = (
        datetime.now(
            timezone.utc
        )
    )

    return assistant_message


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    user_id = user.id
    # Reject inaccessible conversations before reserving a daily question.
    if payload.conversation_id:
        get_user_conversation(db, user_id, payload.conversation_id)

    request_id = getattr(request.state, "request_id", None)
    conversational_response = get_conversational_response(question)
    usage_date = datetime.now(timezone.utc).date()
    quota_reserved = False
    if not conversational_response:
        try:
            consume_question(db, user_id, usage_date)
            quota_reserved = True
        except QuestionLimitExceeded:
            raise HTTPException(status_code=429, detail=(
                "You've reached your daily limit of 20 questions. "
                "Your quota resets at midnight UTC."
            ))

    start = time.perf_counter()
    retrieval_duration_ms = 0.0
    generation_duration_ms = 0.0
    retrieved_chunks = []
    conversation = None
    try:
        conversation = get_or_create_conversation(
            db=db, user_id=user_id, question=question,
            conversation_id=payload.conversation_id,
        )
        save_user_message(db=db, conversation=conversation, question=question)
        if conversational_response:
            generated = GeneratedAnswer(conversational_response, False, [])
        else:
            retrieval_start = time.perf_counter()
            retrieved_chunks = retrieve_chunks(db=db, user_id=user_id, query=question)
            retrieval_duration_ms = (time.perf_counter() - retrieval_start) * 1000
            generation_start = time.perf_counter()
            generated = generate_answer(question=question, results=retrieved_chunks)
            generation_duration_ms = (time.perf_counter() - generation_start) * 1000

        citations = [Citation(
            citation_number=cited.citation_number,
            chunk_id=cited.source.chunk_id,
            document_id=cited.source.document_id,
            filename=cited.source.filename,
            page_number=cited.source.page_number,
            excerpt=cited.source.content[:300],
        ) for cited in generated.sources]
        assistant_message = save_assistant_message(
            db=db, conversation=conversation, answer=generated.answer,
            citations=citations, insufficient_context=generated.insufficient_context,
        )
        db.flush()
        response = ChatResponse(
            conversation_id=conversation.id, message_id=assistant_message.id,
            answer=generated.answer, citations=citations,
            insufficient_context=generated.insufficient_context,
        )
        # Persist the question and answer together. A failed generation must not
        # leave an orphan conversation or duplicate question behind on retry.
        db.commit()
    except Exception as error:
        db.rollback()
        if quota_reserved:
            refund_question(db, user_id, usage_date)
        metrics.record_rag_failed()
        logger.exception("Chat request failed", extra={
            "event": "rag_failed", "request_id": request_id,
            "user_id": str(user_id), "status": "error",
        })
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=503, detail=(
            "We couldn't generate an answer right now. Please try again. "
            "This attempt didn't use a daily question."
        )) from error

    total_duration_ms = (time.perf_counter() - start) * 1000
    if quota_reserved:
        metrics.record_rag_completed(total_duration_ms)
    logger.info("Chat request completed", extra={
        "event": "rag_completed" if quota_reserved else "conversation_completed",
        "request_id": request_id, "user_id": str(user_id),
        "conversation_id": str(response.conversation_id),
        "retrieved_chunk_count": len(retrieved_chunks), "citation_count": len(citations),
        "retrieval_duration_ms": round(retrieval_duration_ms, 2),
        "generation_duration_ms": round(generation_duration_ms, 2),
        "total_duration_ms": round(total_duration_ms, 2), "status": "success",
        "model": settings.openai_chat_model,
    })
    return response
