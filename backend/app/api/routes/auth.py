from fastapi import (
    APIRouter,
    Depends,
)

from app.models.user import User
from app.services.current_user import (
    get_current_user,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


@router.get("/me")
def get_me(
    user: User = Depends(
        get_current_user
    ),
):
    return {
        "id": str(user.id),
        "clerk_user_id": (
            user.clerk_user_id
        ),
        "email": user.email,
    }