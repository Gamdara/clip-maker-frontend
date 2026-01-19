from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.routes import video
from app.utils.file_manager import ensure_directories_exist, cleanup_old_files


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for startup and shutdown
    """
    # Startup
    print("Starting Caption Generator API...")
    ensure_directories_exist()
    print("Cleaning up old files...")
    cleanup_old_files()
    print("API ready!")

    yield

    # Shutdown
    print("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Caption Generator API",
    description="Automatic video caption generation with speech-to-text",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS (allow frontend to access API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(video.router)


@app.get("/")
async def root():
    """
    Root endpoint - API info
    """
    return {
        "name": "Caption Generator API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "upload": "POST /api/upload - Upload video file",
            "process_url": "POST /api/process-url - Process YouTube URL",
            "status": "GET /api/status/{job_id} - Get job status",
            "download": "GET /api/download/{job_id} - Download processed video",
            "docs": "GET /docs - API documentation"
        }
    }


@app.get("/health")
async def health():
    """
    Health check endpoint
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
