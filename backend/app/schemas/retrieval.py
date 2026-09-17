import uuid

from pydantic import BaseModel


class RetrievalRequest(BaseModel):
    query: str


class RetrievedChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    page_number: int
    content: str
    distance: float