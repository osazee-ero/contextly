import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.limits import MAX_FILE_SIZE_BYTES


# class DocumentCreate(BaseModel):
#     filename: str = Field(
#         min_length=1,
#         max_length=255,
#     )

#     file_size_bytes: int = Field(
#         gt=0,
#         le=MAX_FILE_SIZE_BYTES,
#     )


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_size_bytes: int
    page_count: int | None
    status: str
    error_message: str | None = None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
    
    
class DocumentUploadResult(BaseModel):
    filename: str
    success: bool
    document: DocumentResponse | None = None
    error: str | None = None


class DocumentUploadResponse(BaseModel):
    uploaded: int
    failed: int
    results: list[DocumentUploadResult]
