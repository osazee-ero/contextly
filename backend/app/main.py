from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.database import router as database_router
from app.api.routes.documents import router as documents_router
from app.core.config import settings
from app.api.routes.retrieval import (
    router as retrieval_router,
)
from app.api.routes.chat import (
    router as chat_router,
)
from app.api.routes import conversations
from app.api.routes import usage

from app.api.routes import auth

from app.core.logging import (
    configure_logging,
    get_logger,
)
from app.middleware.request_id import (
    RequestIdMiddleware,
)

from app.middleware.request_logging import (
    RequestLoggingMiddleware,
)

from app.api.routes import metrics

configure_logging()

logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)


app.add_middleware(
    RequestLoggingMiddleware
)
app.add_middleware(RequestIdMiddleware)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, _error: Exception):
    request_id = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=500,
        content={"detail": "Contextly couldn't complete this request. Please try again.", "request_id": request_id},
        headers={"X-Request-ID": request_id},
    )


app.include_router(
    health_router,
    prefix="/api",
    tags=["Health"],
)

app.include_router(
    database_router,
    prefix="/api",
    tags=["Database"],
)

app.include_router(
    documents_router,
    prefix="/api/documents",
    tags=["Documents"],
)

app.include_router(
    retrieval_router,
    prefix="/api/retrieval",
    tags=["Retrieval"],
)

app.include_router(
    chat_router,
    prefix="/api/chat",
    tags=["Chat"],
)

app.include_router(
    metrics.router,
    prefix="/api/metrics",
    tags=["metrics"],
)

app.include_router(
    conversations.router
)

app.include_router(
    usage.router
)

app.include_router(auth.router)

@app.get("/")
def root(): 
    return {
        "message": "Contextly API",
    }


# Keep CORS outside ServerErrorMiddleware so failures are readable by browsers,
# instead of disguising every unhandled server error as "Failed to fetch".
api = app
app = CORSMiddleware(
    app=api,
    allow_origins=[settings.frontend_url.rstrip("/")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
