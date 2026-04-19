import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api import auth as auth_router
from app.api import image as image_router
from app.api import ocr as ocr_router
from app.api import pdf as pdf_router
from app.api import scanner as scanner_router
from app.api import tasks as tasks_router
from app.api import users as users_router
from app.config import settings
from app.core.rate_limit import limiter

logger = logging.getLogger("imagify")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Imagify AI", version="0.1.0")

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal database error"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(auth_router.router)
app.include_router(tasks_router.router)
app.include_router(pdf_router.router)
app.include_router(image_router.router)
app.include_router(scanner_router.router)
app.include_router(ocr_router.router)
app.include_router(users_router.router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
