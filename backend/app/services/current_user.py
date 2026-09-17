from fastapi import (
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from clerk_backend_api import Clerk

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.auth import (
    AuthenticatedUser,
    get_authenticated_user,
)


clerk = Clerk(
    bearer_auth=settings.clerk_secret_key,
)


def get_current_user(
    authenticated_user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
    db: Session = Depends(get_db),
) -> User:
    statement = (
        select(User)
        .where(
            User.clerk_user_id ==
            authenticated_user.clerk_user_id
        )
    )

    user = db.execute(
        statement
    ).scalar_one_or_none()

    if user:
        return user

    try:
        clerk_user = clerk.users.get(
            user_id=
                authenticated_user.clerk_user_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to load Clerk user.",
        ) from exc

    primary_email_id = (
        clerk_user.primary_email_address_id
    )

    email = None

    for email_address in (
        clerk_user.email_addresses or []
    ):
        if (
            email_address.id ==
            primary_email_id
        ):
            email = email_address.email_address
            break

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No primary email address "
                "was found for this account."
            ),
        )

    existing_email_user = (
        db.execute(
            select(User).where(
                User.email == email
            )
        )
        .scalar_one_or_none()
    )

    if existing_email_user:
        # Email is not an account identifier. Never transfer another identity's
        # documents when an address is reused, or implicitly claim legacy data.
        if existing_email_user.clerk_user_id != authenticated_user.clerk_user_id:
            raise HTTPException(
                status_code=409,
                detail="This email belongs to another account. Sign in with your original account.",
            )
        return existing_email_user

    # Dashboard, sidebar, and document requests can arrive together on signup.
    # PostgreSQL waits for the competing insert instead of raising a unique
    # constraint error. Resolve the winner by verified Clerk identity only.
    db.execute(insert(User).values(
        clerk_user_id=authenticated_user.clerk_user_id,
        email=email,
    ).on_conflict_do_nothing())
    db.commit()
    user = db.scalar(statement)
    if user is None:
        raise HTTPException(
            status_code=409,
            detail="This email belongs to another account. Sign in with your original account.",
        )
    return user
