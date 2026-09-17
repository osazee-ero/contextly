import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
)
from app.services.current_user import (
    get_current_user,
)


router = APIRouter(
    prefix="/api/conversations",
    tags=["conversations"],
)


@router.get(
    "",
    response_model=list[ConversationSummary],
)
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    statement = (
        select(Conversation)
        .where(
            Conversation.user_id
            == user.id
        )
        .order_by(
            Conversation.updated_at.desc()
        )
    )

    conversations = (
        db.execute(statement)
        .scalars()
        .all()
    )

    return conversations


@router.post(
    "",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    title = payload.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Conversation title cannot be empty.",
        )

    conversation = Conversation(
        user_id=user.id,
        title=title[:255],
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
)
def get_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    statement = (
        select(Conversation)
        .options(
            selectinload(
                Conversation.messages
            )
        )
        .where(
            Conversation.id
            == conversation_id,
            Conversation.user_id
            == user.id,
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


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    statement = (
        select(Conversation)
        .where(
            Conversation.id
            == conversation_id,
            Conversation.user_id
            == user.id,
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

    db.delete(conversation)
    db.commit()

    return None