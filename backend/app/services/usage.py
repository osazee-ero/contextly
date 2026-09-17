import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.limits import MAX_QUESTIONS_PER_DAY
from app.models.daily_usage import DailyUsage


class QuestionLimitExceeded(Exception):
    pass


def consume_question(
    db: Session,
    user_id: uuid.UUID,
    usage_date: date | None = None,
) -> int:
    """
    Atomically consume one question from
    the user's daily quota.

    Returns the new question count.

    Raises QuestionLimitExceeded when the
    daily limit has already been reached.
    """

    today = usage_date or datetime.now(timezone.utc).date()

    statement = (
        insert(DailyUsage)
        .values(
            user_id=user_id,
            usage_date=today,
            question_count=1,
        )
        .on_conflict_do_update(
            index_elements=[
                DailyUsage.user_id,
                DailyUsage.usage_date,
            ],
            set_={
                "question_count":
                    DailyUsage.question_count + 1,
                "updated_at":
                    func.now(),
            },
            where=(
                DailyUsage.question_count
                < MAX_QUESTIONS_PER_DAY
            ),
        )
        .returning(
            DailyUsage.question_count
        )
    )

    question_count = (
        db.execute(statement)
        .scalar_one_or_none()
    )

    if question_count is None:
        db.rollback()

        raise QuestionLimitExceeded(
            "Daily question limit reached."
        )

    db.commit()

    return question_count


def refund_question(
    db: Session,
    user_id: uuid.UUID,
    usage_date: date | None = None,
) -> None:
    """
    Refund one question when Contextly
    fails internally after reserving quota.
    """

    today = usage_date or datetime.now(timezone.utc).date()

    usage = (
        db.query(DailyUsage)
        .filter(
            DailyUsage.user_id == user_id,
            DailyUsage.usage_date == today,
        )
        .with_for_update()
        .one_or_none()
    )

    if usage is None:
        db.rollback()
        return

    if usage.question_count > 0:
        usage.question_count -= 1

    db.commit()