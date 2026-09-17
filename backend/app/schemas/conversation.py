import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list
    insufficient_context: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ConversationSummary(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ConversationDetail(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]

    model_config = ConfigDict(
        from_attributes=True
    )


class ConversationCreate(BaseModel):
    title: str