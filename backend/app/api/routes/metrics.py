from fastapi import (
    APIRouter,
    Depends,
)

from app.core.metrics import metrics
from app.models.user import User
from app.services.current_user import (
    get_current_user,
)


router = APIRouter()


@router.get("")
def get_metrics(
    user: User = Depends(
        get_current_user
    ),
):
    return metrics.snapshot()