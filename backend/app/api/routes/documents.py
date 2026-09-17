import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.limits import (
    MAX_DOCUMENTS_PER_USER,
    MAX_FILE_SIZE_BYTES,
    MAX_STORAGE_PER_USER_BYTES,
)
from app.db.session import get_db
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.current_user import get_current_user
from app.services.document_ingestion import ingest_document
from app.services.file_storage import (
    FileValidationError,
    validate_pdf,
)
from app.services.storage import (
    delete_file,
    save_file,
)


router = APIRouter()


@router.get(
    "",
    response_model=list[DocumentResponse],
)
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    documents = db.scalars(
        select(Document)
        .where(
            Document.user_id == user.id
        )
        .order_by(
            Document.created_at.desc()
        )
    ).all()

    return documents


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # -------------------------
    # Check document quota
    # -------------------------
    # Serialize quota checks for this user, including concurrent browser tabs.
    db.execute(select(User.id).where(User.id == user.id).with_for_update())
    document_count = (
        db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.user_id == user.id
            )
        )
        or 0
    )

    if (
        document_count
        >= MAX_DOCUMENTS_PER_USER
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Document limit of "
                f"{MAX_DOCUMENTS_PER_USER} "
                f"reached."
            ),
        )

    # -------------------------
    # Calculate current storage
    # -------------------------
    storage_used = (
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

    filename = (
        file.filename
        or "Unknown file"
    )

    # -------------------------
    # Read uploaded file
    # -------------------------
    file_bytes = file.file.read(MAX_FILE_SIZE_BYTES + 1)

    # -------------------------
    # Validate PDF
    # -------------------------
    try:
        pdf_info = validate_pdf(
            filename=filename,
            content_type=file.content_type,
            content=file_bytes,
        )

    except FileValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # -------------------------
    # Check total storage quota
    # -------------------------
    new_total_storage = (
        storage_used
        + pdf_info.file_size_bytes
    )

    if (
        new_total_storage
        > MAX_STORAGE_PER_USER_BYTES
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Storage limit of "
                "100 MB reached."
            ),
        )

    # -------------------------
    # Save to configured storage
    # -------------------------
    try:
        storage_key = save_file(
            user_id=str(user.id),
            filename=filename,
            content=file_bytes,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to store document."
            ),
        ) from exc

    # -------------------------
    # Create database record
    # -------------------------
    document = Document(
        user_id=user.id,
        filename=filename,
        storage_key=storage_key,
        file_size_bytes=(
            pdf_info.file_size_bytes
        ),
        page_count=(
            pdf_info.page_count
        ),
        status="processing",
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)

    except Exception:
        db.rollback()

        # Prevent orphaned file
        try:
            delete_file(
                storage_key
            )
        except Exception:
            pass

        raise

    # -------------------------
    # Start background ingestion
    # -------------------------
    background_tasks.add_task(
        ingest_document,
        document.id,
    )

    return document


@router.post("/{document_id}/retry", response_model=DocumentResponse,
             status_code=status.HTTP_202_ACCEPTED)
def retry_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.scalar(select(Document).where(
        Document.id == document_id, Document.user_id == user.id,
    ).with_for_update())
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status != "failed":
        raise HTTPException(status_code=409, detail="Only failed documents can be retried.")
    if not document.storage_key:
        raise HTTPException(status_code=409, detail="The file is missing. Delete this document and upload it again.")
    document.status = "processing"
    document.error_message = None
    db.commit()
    db.refresh(document)
    background_tasks.add_task(ingest_document, document.id)
    return document


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
        ).with_for_update()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    if document.status.lower() == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This document is still processing. "
                "Please wait until processing finishes "
                "before deleting it."
            ),
        )

    storage_key = (
        document.storage_key
    )

    try:
        db.delete(document)
        db.commit()

    except Exception:
        db.rollback()
        raise

    # -------------------------
    # Delete stored file
    # -------------------------
    if storage_key:
        try:
            delete_file(
                storage_key
            )
        except Exception:
            # Database record is already deleted.
            # Storage cleanup failure should not
            # falsely return a server error here.
            pass

    return None


@router.get(
    "/{document_id}/chunks",
)
def get_document_chunks(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    chunks = db.scalars(
        select(DocumentChunk)
        .where(
            DocumentChunk.document_id
            == document.id
        )
        .order_by(
            DocumentChunk.chunk_index
        )
    ).all()

    return [
        {
            "id": chunk.id,
            "page_number": (
                chunk.page_number
            ),
            "chunk_index": (
                chunk.chunk_index
            ),
            "content": (
                chunk.content
            ),
        }
        for chunk in chunks
    ]
