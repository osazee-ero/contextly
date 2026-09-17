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


@router.post(
    "",
    response_model=ChatResponse,
)
def chat(
    payload: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = payload.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    request_id = getattr(
        request.state,
        "request_id",
        None,
    )

    # -------------------------------------------------
    # 1. Handle simple conversational messages
    #    without embeddings, retrieval, LLM calls,
    #    or question quota usage.
    # -------------------------------------------------

    conversational_response = (
        get_conversational_response(
            question
        )
    )

    if conversational_response:
        conversational_start = (
            time.perf_counter()
        )

        conversation = (
            get_or_create_conversation(
                db=db,
                user_id=user.id,
                question=question,
                conversation_id=(
                    payload.conversation_id
                ),
            )
        )

        save_user_message(
            db=db,
            conversation=conversation,
            question=question,
        )

        assistant_message = (
            save_assistant_message(
                db=db,
                conversation=conversation,
                answer=(
                    conversational_response
                ),
                citations=[],
                insufficient_context=False,
            )
        )

        db.commit()

        db.refresh(
            assistant_message
        )

        conversational_duration_ms = (
            time.perf_counter()
            - conversational_start
        ) * 1000

        logger.info(
            "Conversational message completed",
            extra={
                "event": (
                    "conversation_completed"
                ),
                "request_id": request_id,
                "user_id": str(
                    user.id
                ),
                "conversation_id": str(
                    conversation.id
                ),
                "total_duration_ms": round(
                    conversational_duration_ms,
                    2,
                ),
                "status": "success",
            },
        )

        return ChatResponse(
            conversation_id=(
                conversation.id
            ),
            message_id=(
                assistant_message.id
            ),
            answer=(
                conversational_response
            ),
            citations=[],
            insufficient_context=False,
        )

    # -------------------------------------------------
    # 2. Real document question:
    #    consume question quota.
    # -------------------------------------------------

    try:
        consume_question(
            db=db,
            user_id=user.id,
        )

    except QuestionLimitExceeded:
        logger.warning(
            "Question quota exceeded",
            extra={
                "event": (
                    "question_quota_exceeded"
                ),
                "request_id": request_id,
                "user_id": str(
                    user.id
                ),
                "status": "rejected",
            },
        )

        raise HTTPException(
            status_code=429,
            detail=(
                "You've reached your daily "
                "limit of 20 questions. "
                "Your quota resets tomorrow."
            ),
        )

    # -------------------------------------------------
    # 3. Get or create conversation
    # -------------------------------------------------

    conversation = (
        get_or_create_conversation(
            db=db,
            user_id=user.id,
            question=question,
            conversation_id=(
                payload.conversation_id
            ),
        )
    )

    # -------------------------------------------------
    # 4. Save user message
    # -------------------------------------------------

    save_user_message(
        db=db,
        conversation=conversation,
        question=question,
    )

    db.commit()

    # -------------------------------------------------
    # 5. Retrieve relevant chunks and generate
    #    grounded answer.
    # -------------------------------------------------

    total_start = time.perf_counter()

    retrieval_duration_ms = 0.0
    generation_duration_ms = 0.0

    retrieved_chunks = []

    try:
        retrieval_start = (
            time.perf_counter()
        )

        retrieved_chunks = (
            retrieve_chunks(
                db=db,
                user_id=user.id,
                query=question,
            )
        )

        retrieval_duration_ms = (
            time.perf_counter()
            - retrieval_start
        ) * 1000

        generation_start = (
            time.perf_counter()
        )

        generated = generate_answer(
            question=question,
            results=retrieved_chunks,
        )

        generation_duration_ms = (
            time.perf_counter()
            - generation_start
        ) * 1000

    except Exception:
        total_duration_ms = (
            time.perf_counter()
            - total_start
        ) * 1000
        
        metrics.record_rag_failed()

        logger.exception(
            "RAG question failed",
            extra={
                "event": "rag_failed",
                "request_id": request_id,
                "user_id": str(
                    user.id
                ),
                "conversation_id": str(
                    conversation.id
                ),
                "retrieved_chunk_count": len(
                    retrieved_chunks
                ),
                "retrieval_duration_ms": round(
                    retrieval_duration_ms,
                    2,
                ),
                "generation_duration_ms": round(
                    generation_duration_ms,
                    2,
                ),
                "total_duration_ms": round(
                    total_duration_ms,
                    2,
                ),
                "model": (
                    settings.openai_chat_model
                ),
                "status": "error",
            },
        )

        refund_question(
            db=db,
            user_id=user.id,
        )

        raise

    # -------------------------------------------------
    # 6. Build citations
    # -------------------------------------------------

    citations = [
        Citation(
            citation_number=(
                cited.citation_number
            ),
            chunk_id=(
                cited.source.chunk_id
            ),
            document_id=(
                cited.source.document_id
            ),
            filename=(
                cited.source.filename
            ),
            page_number=(
                cited.source.page_number
            ),
            excerpt=(
                cited.source.content[:300]
            ),
        )
        for cited in generated.sources
    ]

    # -------------------------------------------------
    # 7. Save assistant answer
    # -------------------------------------------------

    try:
        assistant_message = (
            save_assistant_message(
                db=db,
                conversation=conversation,
                answer=generated.answer,
                citations=citations,
                insufficient_context=(
                    generated.insufficient_context
                ),
            )
        )

        db.commit()

        db.refresh(
            assistant_message
        )

    except Exception:
        metrics.record_rag_failed()
        logger.exception(
            "Failed to save assistant message",
            extra={
                "event": (
                    "assistant_message_save_failed"
                ),
                "request_id": request_id,
                "user_id": str(
                    user.id
                ),
                "conversation_id": str(
                    conversation.id
                ),
                "status": "error",
            },
        )

        raise

    # -------------------------------------------------
    # 8. Calculate total RAG duration
    # -------------------------------------------------

    total_duration_ms = (
        time.perf_counter()
        - total_start
    ) * 1000

    # -------------------------------------------------
    # 9. Log successful RAG request
    # -------------------------------------------------
    metrics.record_rag_completed(
            total_duration_ms
        )
    logger.info(
        "RAG question completed",
        extra={
            "event": "rag_completed",
            "request_id": request_id,
            "user_id": str(
                user.id
            ),
            "conversation_id": str(
                conversation.id
            ),
            "retrieved_chunk_count": len(
                retrieved_chunks
            ),
            "citation_count": len(
                citations
            ),
            "insufficient_context": (
                generated.insufficient_context
            ),
            "retrieval_duration_ms": round(
                retrieval_duration_ms,
                2,
            ),
            "generation_duration_ms": round(
                generation_duration_ms,
                2,
            ),
            "total_duration_ms": round(
                total_duration_ms,
                2,
            ),
            "model": (
                settings.openai_chat_model
            ),
            "status": "success",
        },
    )

    # -------------------------------------------------
    # 10. Return response
    # -------------------------------------------------

    return ChatResponse(
        conversation_id=(
            conversation.id
        ),
        message_id=(
            assistant_message.id
        ),
        answer=generated.answer,
        citations=citations,
        insufficient_context=(
            generated.insufficient_context
        ),
    )