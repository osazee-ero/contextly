from pathlib import Path
import uuid

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
    )


def save_file(
    *,
    user_id: str,
    filename: str,
    content: bytes,
) -> str:
    if settings.storage_backend == "s3":
        return _save_to_s3(
            user_id=user_id,
            filename=filename,
            content=content,
        )

    return _save_locally(
        user_id=user_id,
        filename=filename,
        content=content,
    )


def _save_locally(
    *,
    user_id: str,
    filename: str,
    content: bytes,
) -> str:
    extension = Path(
        filename
    ).suffix.lower()

    stored_filename = (
        f"{uuid.uuid4()}{extension}"
    )

    user_directory = (
        Path(settings.storage_path)
        / str(user_id)
    )

    user_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        user_directory
        / stored_filename
    )

    path.write_bytes(content)

    return str(
        Path(str(user_id))
        / stored_filename
    )


def _save_to_s3(
    *,
    user_id: str,
    filename: str,
    content: bytes,
) -> str:
    if not settings.aws_s3_bucket:
        raise RuntimeError(
            "AWS_S3_BUCKET is not configured."
        )

    extension = Path(
        filename
    ).suffix.lower()

    key = (
        f"users/{user_id}/documents/"
        f"{uuid.uuid4()}{extension}"
    )

    _s3_client().put_object(
        Bucket=settings.aws_s3_bucket,
        Key=key,
        Body=content,
        ContentType="application/pdf",
    )

    return key


def read_file_bytes(
    storage_key: str,
) -> bytes:
    if settings.storage_backend == "s3":
        return _read_from_s3(
            storage_key
        )

    return _read_local_file(
        storage_key
    )


def _read_local_file(
    storage_key: str,
) -> bytes:
    path = (
        Path(settings.storage_path)
        / storage_key
    )

    if not path.exists():
        raise FileNotFoundError(
            f"Stored file not found: "
            f"{storage_key}"
        )

    return path.read_bytes()


def _read_from_s3(
    storage_key: str,
) -> bytes:
    if not settings.aws_s3_bucket:
        raise RuntimeError(
            "AWS_S3_BUCKET is not configured."
        )

    try:
        response = (
            _s3_client().get_object(
                Bucket=settings.aws_s3_bucket,
                Key=storage_key,
            )
        )
    except ClientError as error:
        error_code = (
            error.response
            .get("Error", {})
            .get("Code")
        )

        if error_code in {
            "NoSuchKey",
            "404",
        }:
            raise FileNotFoundError(
                f"S3 object not found: "
                f"{storage_key}"
            ) from error

        raise

    return response[
        "Body"
    ].read()


def delete_file(
    storage_key: str,
) -> None:
    if settings.storage_backend == "s3":
        _delete_from_s3(
            storage_key
        )

        return

    _delete_local_file(
        storage_key
    )


def _delete_local_file(
    storage_key: str,
) -> None:
    path = (
        Path(settings.storage_path)
        / storage_key
    )

    if path.exists():
        path.unlink()


def _delete_from_s3(
    storage_key: str,
) -> None:
    if not settings.aws_s3_bucket:
        raise RuntimeError(
            "AWS_S3_BUCKET is not configured."
        )

    _s3_client().delete_object(
        Bucket=settings.aws_s3_bucket,
        Key=storage_key,
    )