from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.core.limits import (
    MAX_DOCUMENTS_PER_USER,
    MAX_QUESTIONS_PER_DAY,
    MAX_STORAGE_PER_USER_BYTES,
)
from app.db.session import get_db
from app.models.daily_usage import DailyUsage
from app.models.document import Document
from app.models.user import User
from app.schemas.usage import UsageResponse
from app.services.current_user import (
    get_current_user,
)


router = APIRouter(
    prefix="/api/usage",
    tags=["usage"],
)


@router.get(
    "",
    response_model=UsageResponse,
)
def get_usage(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = datetime.now(
        timezone.utc
    ).date()

    # -------------------------
    # Questions used today
    # -------------------------
    usage = db.scalar(
        select(DailyUsage).where(
            DailyUsage.user_id == user.id,
            DailyUsage.usage_date == today,
        )
    )

    questions_used = (
        usage.question_count
        if usage
        else 0
    )

    # -------------------------
    # Documents used
    # -------------------------
    documents_used = (
        db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.user_id == user.id
            )
        )
        or 0
    )

    # -------------------------
    # Storage used
    # -------------------------
    storage_used_bytes = (
        db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        Document.file_size_bytes
                    ),
                    0,
                )
            ).where(
                Document.user_id == user.id
            )
        )
        or 0
    )

    return UsageResponse(
        documents_used=documents_used,
        documents_limit=(
            MAX_DOCUMENTS_PER_USER
        ),
        storage_used_bytes=(
            storage_used_bytes
        ),
        storage_limit_bytes=(
            MAX_STORAGE_PER_USER_BYTES
        ),
        questions_used=questions_used,
        questions_limit=(
            MAX_QUESTIONS_PER_DAY
        ),
        questions_remaining=max(
            MAX_QUESTIONS_PER_DAY
            - questions_used,
            0,
        ),
    )