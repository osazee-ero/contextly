from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader

from app.core.limits import MAX_FILE_SIZE_BYTES


class FileValidationError(Exception):
    pass


@dataclass
class PDFInfo:
    file_size_bytes: int
    page_count: int


def validate_pdf(
    *,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> PDFInfo:
    # -------------------------
    # Validate filename
    # -------------------------
    if not filename.lower().endswith(".pdf"):
        raise FileValidationError(
            "Only PDF files are supported."
        )

    if len(filename) > 255:
        raise FileValidationError("The filename is too long. Rename the PDF to 255 characters or fewer.")

    # -------------------------
    # Validate content type
    # -------------------------
    allowed_content_types = {
        "application/pdf",
        "application/octet-stream",
    }

    if (
        content_type
        and content_type
        not in allowed_content_types
    ):
        raise FileValidationError(
            "File does not appear to be a PDF."
        )

    # -------------------------
    # Validate file is not empty
    # -------------------------
    if not content:
        raise FileValidationError(
            "The uploaded PDF is empty."
        )

    # -------------------------
    # Validate file size
    # -------------------------
    file_size_bytes = len(content)

    if (
        file_size_bytes
        > MAX_FILE_SIZE_BYTES
    ):
        raise FileValidationError(
            "PDF exceeds the 10 MB upload limit."
        )

    # -------------------------
    # Validate PDF signature
    # -------------------------
    if not content.startswith(b"%PDF-"):
        raise FileValidationError(
            "Invalid PDF file."
        )

    # -------------------------
    # Parse PDF
    # -------------------------
    try:
        reader = PdfReader(
            BytesIO(content)
        )

        if reader.is_encrypted:
            raise FileValidationError(
                "Password-protected PDFs "
                "are not supported."
            )

        page_count = len(
            reader.pages
        )
        if page_count == 0:
            raise FileValidationError("The PDF contains no pages.")

    except FileValidationError:
        raise

    except Exception as exc:
        raise FileValidationError(
            "The PDF could not be read."
        ) from exc

    # -------------------------
    # Return metadata
    # -------------------------
    return PDFInfo(
        file_size_bytes=(
            file_size_bytes
        ),
        page_count=(
            page_count
        ),
    )
