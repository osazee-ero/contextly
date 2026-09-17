from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.retrieval import (
    RetrievalRequest,
    RetrievedChunk,
)
from app.services.current_user import (
    get_current_user,
)
from app.services.retrieval import (
    retrieve_chunks,
)


router = APIRouter()


@router.post(
    "",
    response_model=list[RetrievedChunk],
)
def retrieve(
    payload: RetrievalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    results = retrieve_chunks(
        db=db,
        user_id=user.id,
        query=payload.query,
    )

    return [
        RetrievedChunk(
            chunk_id=result.chunk_id,
            document_id=result.document_id,
            filename=result.filename,
            page_number=result.page_number,
            content=result.content,
            distance=result.distance,
        )
        for result in results
    ]