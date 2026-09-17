from dataclasses import dataclass

from clerk_backend_api import (
    AuthenticateRequestOptions,
    authenticate_request,
)
from fastapi import (
    HTTPException,
    Request,
    status,
)

from app.core.config import settings


@dataclass
class AuthenticatedUser:
    clerk_user_id: str


def get_authenticated_user(
    request: Request,
) -> AuthenticatedUser:
    request_state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=settings.clerk_secret_key,
            authorized_parties=[
                settings.frontend_url.rstrip("/"),
            ],
            accepts_token=[
                "session_token",
            ],
        ),
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    if not request_state.payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    clerk_user_id = (
        request_state.payload.get("sub")
    )

    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    return AuthenticatedUser(
        clerk_user_id=clerk_user_id,
    )
