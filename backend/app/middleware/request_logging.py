import time

from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.requests import Request

from app.core.logging import get_logger
from app.core.metrics import metrics


logger = get_logger(__name__)


class RequestLoggingMiddleware(
    BaseHTTPMiddleware
):
    async def dispatch(
        self,
        request: Request,
        call_next,
    ):
        start = time.perf_counter()

        request_id = getattr(
            request.state,
            "request_id",
            None,
        )

        try:
            response = await call_next(
                request
            )

            duration_ms = (
                time.perf_counter()
                - start
            ) * 1000

            metrics.record_http_request(duration_ms)
            logger.info(
                "HTTP request completed",
                extra={
                    "event": (
                        "http_request_completed"
                    ),
                    "request_id": (
                        request_id
                    ),
                    "method": (
                        request.method
                    ),
                    "path": (
                        request.url.path
                    ),
                    "status_code": (
                        response.status_code
                    ),
                    "request_duration_ms": round(
                        duration_ms,
                        2,
                    ),
                    "status": "error" if response.status_code >= 400 else "success",
                },
            )

            return response

        except Exception:
            duration_ms = (
                time.perf_counter()
                - start
            ) * 1000
            
            metrics.record_http_request(
                    duration_ms
                )

            logger.exception(
                "HTTP request failed",
                extra={
                    "event": (
                        "http_request_failed"
                    ),
                    "request_id": (
                        request_id
                    ),
                    "method": (
                        request.method
                    ),
                    "path": (
                        request.url.path
                    ),
                    "request_duration_ms": round(
                        duration_ms,
                        2,
                    ),
                    "status": "error",
                },
            )

            raise