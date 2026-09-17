import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if hasattr(record, "request_id"):
            log_record["request_id"] = (
                record.request_id
            )

        if hasattr(record, "user_id"):
            log_record["user_id"] = (
                record.user_id
            )

        if hasattr(record, "conversation_id"):
            log_record["conversation_id"] = (
                record.conversation_id
            )

        if hasattr(record, "document_id"):
            log_record["document_id"] = (
                record.document_id
            )

        if hasattr(record, "event"):
            log_record["event"] = (
                record.event
            )
        extra_fields = [
            "retrieved_chunk_count",
            "citation_count",
            "insufficient_context",
            "retrieval_duration_ms",
            "generation_duration_ms",
            "total_duration_ms",
            "model",
            "status",

            "page_count",
            "chunk_count",
            "extraction_duration_ms",
            "embedding_duration_ms",
            "ingestion_duration_ms",

            "method",
            "path",
            "status_code",
            "request_duration_ms",
        ]

        for field in extra_fields:
            if hasattr(record, field):
                log_record[field] = getattr(
                    record,
                    field,
                )

        if record.exc_info:
            log_record["exception"] = (
                self.formatException(
                    record.exc_info
                )
            )

        return json.dumps(
            log_record,
            ensure_ascii=False,
        )


def configure_logging() -> None:
    handler = logging.StreamHandler(
        sys.stdout
    )

    handler.setFormatter(
        JsonFormatter()
    )

    root_logger = logging.getLogger()

    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    root_logger.setLevel(
        logging.INFO
    )


def get_logger(
    name: str,
) -> logging.Logger:
    return logging.getLogger(name)