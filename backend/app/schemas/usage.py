# backend/app/schemas/usage.py

from pydantic import BaseModel


class UsageResponse(BaseModel):
    documents_used: int
    documents_limit: int

    storage_used_bytes: int
    storage_limit_bytes: int

    questions_used: int
    questions_limit: int
    questions_remaining: int