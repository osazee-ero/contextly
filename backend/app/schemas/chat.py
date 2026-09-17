import uuid

from pydantic import (
    BaseModel,
    Field,
)


class ChatRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=2000,
    )

    conversation_id: uuid.UUID | None = None


class Citation(BaseModel):
    citation_number: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    page_number: int
    excerpt: str


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message_id: uuid.UUID

    answer: str

    citations: list[Citation]

    insufficient_context: bool