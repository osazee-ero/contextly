from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db


router = APIRouter()

logger = get_logger(__name__)


@router.get("/database")
def database_health(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception:
        logger.exception(
            "database_health_check_failed",
            extra={
                "event": "database_health_check_failed",
            },
        )

        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )