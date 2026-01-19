from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
from datetime import datetime
from typing import Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.models import (
    ProcessUrlRequest,
    ProcessUploadRequest,
    JobResponse,
    JobStatusResponse,
    JobStatus,
    JobData,
    Caption,
    ExtractMetadataRequest,
    VideoMetadata,
    CropConfig,
    UploadPreviewResponse
)
from app.services.downloader import download_youtube, validate_youtube_url, extract_video_metadata, DownloaderError
from app.services.transcriber import transcribe_audio, TranscriberError
from app.services.segmenter import segment_captions
from app.services.renderer import burn_captions, RendererError
from app.utils.file_manager import delete_job_files
from app.config import UPLOAD_DIR, MAX_UPLOAD_SIZE, ALLOWED_VIDEO_EXTENSIONS, TEMP_DIR, OUTPUT_DIR
from app.websocket_manager import manager

router = APIRouter(prefix="/api", tags=["video"])

# In-memory job storage (use Redis/database in production)
jobs: Dict[str, JobData] = {}

# Thread pool for blocking IO operations
thread_pool = ThreadPoolExecutor(max_workers=4)


def extract_local_video_metadata(video_path: str, filename: str = "video") -> VideoMetadata:
    """Extract metadata from a local video file using ffprobe"""
    import subprocess
    import json

    # Get video info using ffprobe
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        video_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"ffprobe failed: {result.stderr}")

    info = json.loads(result.stdout)

    # Find video stream
    video_stream = None
    for stream in info.get('streams', []):
        if stream.get('codec_type') == 'video':
            video_stream = stream
            break

    if not video_stream:
        raise Exception("No video stream found")

    # Extract info
    width = video_stream.get('width', 1920)
    height = video_stream.get('height', 1080)
    duration = float(info.get('format', {}).get('duration', 0))

    # Get title from filename
    title = Path(filename).stem if filename else "Uploaded Video"

    return VideoMetadata(
        title=title,
        duration=duration,
        width=width,
        height=height,
        thumbnail_url="",  # No thumbnail for uploads
        embed_url=None,
        video_id=None,
        preview_url=None,  # Will be set by endpoint
        source_type="upload"
    )


def generate_srt_file(captions: list[Caption], output_path: Path) -> None:
    """
    Generate SRT subtitle file from caption objects

    Args:
        captions: List of Caption objects
        output_path: Path to save the SRT file
    """
    def format_timestamp(seconds: float) -> str:
        """Convert seconds to SRT timestamp format HH:MM:SS,mmm"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        for i, caption in enumerate(captions, 1):
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(caption.start)} --> {format_timestamp(caption.end)}\n")
            f.write(f"{caption.text}\n\n")


async def render_video_with_captions(job_id: str):
    """
    Render video with captions (called after editing or skip)

    Args:
        job_id: Job ID
    """
    if job_id not in jobs:
        return

    job = jobs[job_id]

    if not job.captions or not job.video_path:
        await update_job_status(job_id, JobStatus.FAILED, 0, "Missing captions or video")
        return

    try:
        await update_job_status(job_id, JobStatus.RENDERING, 80, "Burning captions into video...")

        # Generate SRT from current captions
        srt_path = TEMP_DIR / f"{job_id}_final.srt"
        generate_srt_file(job.captions, srt_path)

        # Burn captions with FFmpeg in thread pool
        loop = asyncio.get_event_loop()
        output_path = await loop.run_in_executor(thread_pool, burn_captions, job.video_path, job.captions, job_id)

        job.output_path = output_path

        # Cleanup SRT files
        srt_path.unlink(missing_ok=True)
        if job.srt_path:
            Path(job.srt_path).unlink(missing_ok=True)

        await update_job_status(job_id, JobStatus.COMPLETED, 100, "Processing complete!")
        job.completed_at = datetime.now()

    except RendererError as e:
        await update_job_status(job_id, JobStatus.FAILED, 0, f"Rendering failed: {str(e)}")
        job.error = str(e)
    except Exception as e:
        await update_job_status(job_id, JobStatus.FAILED, 0, f"Rendering failed: {str(e)}")
        job.error = str(e)


async def update_job_status(job_id: str, status: JobStatus, progress: int, message: str):
    """Update job status and broadcast to WebSocket clients"""
    jobs[job_id].status = status
    jobs[job_id].progress = progress
    jobs[job_id].message = message

    # Broadcast to WebSocket clients
    await manager.broadcast_status(job_id, {
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "message": message,
        "created_at": jobs[job_id].created_at.isoformat(),
        "completed_at": jobs[job_id].completed_at.isoformat() if jobs[job_id].completed_at else None,
        "download_url": f"/api/download/{job_id}" if status == JobStatus.COMPLETED else None
    })


async def process_video_job(job_id: str, video_path: str):
    """
    Background task to process video: transcribe + segment, then wait for editing

    Args:
        job_id: Job ID
        video_path: Path to video file
    """
    try:
        # Update status: processing started
        await update_job_status(job_id, JobStatus.PENDING, 20, "Starting video processing...")

        # Update status: transcribing
        await update_job_status(job_id, JobStatus.TRANSCRIBING, 30, "Transcribing audio...")

        # Transcribe in thread pool
        loop = asyncio.get_event_loop()
        words = await loop.run_in_executor(thread_pool, transcribe_audio, video_path)

        # Check if any words were transcribed
        if not words or len(words) == 0:
            jobs[job_id].error = "No words transcribed from audio"
            await update_job_status(job_id, JobStatus.FAILED, 0, "No speech detected in video. Cannot generate captions.")
            return

        # Update status: segmenting
        await update_job_status(job_id, JobStatus.TRANSCRIBING, 60, "Segmenting captions...")

        # Segment captions
        captions = segment_captions(words)

        # STOP HERE - Store captions and wait for user editing
        job = jobs[job_id]
        job.captions = captions

        # Generate SRT file for preview/download
        srt_path = OUTPUT_DIR / f"{job_id}_captions.srt"
        generate_srt_file(captions, srt_path)
        job.srt_path = str(srt_path)

        # Move to EDITING state
        await update_job_status(
            job_id,
            JobStatus.EDITING,
            65,
            "Captions ready for editing"
        )

        # DO NOT continue to rendering - wait for user action
        # Rendering will be triggered by:
        # - POST /captions/{job_id} (after editing)
        # - POST /captions/{job_id}/skip (skip editing)

    except TranscriberError as e:
        jobs[job_id].error = str(e)
        await update_job_status(job_id, JobStatus.FAILED, 0, f"Transcription failed: {str(e)}")
    except Exception as e:
        jobs[job_id].error = str(e)
        await update_job_status(job_id, JobStatus.FAILED, 0, f"Processing failed: {str(e)}")


@router.post("/upload", response_model=JobResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Upload a video file for caption generation

    Returns job_id for status tracking
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Save uploaded file
    upload_path = UPLOAD_DIR / f"{job_id}{file_ext}"

    try:
        # Read and save file
        content = await file.read()

        # Check file size
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_UPLOAD_SIZE / 1024 / 1024:.0f}MB"
            )

        with open(upload_path, 'wb') as f:
            f.write(content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    # Create job entry
    jobs[job_id] = JobData(
        job_id=job_id,
        status=JobStatus.PENDING,
        progress=10,
        message="Video uploaded, processing...",
        created_at=datetime.now(),
        video_path=str(upload_path)
    )

    # Start background processing
    background_tasks.add_task(process_video_job, job_id, str(upload_path))

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="Video uploaded successfully"
    )


@router.post("/extract-metadata", response_model=VideoMetadata)
async def extract_metadata(request: ExtractMetadataRequest):
    """
    Extract video metadata from YouTube URL without downloading.

    Returns video info for trimmer preview page.
    """
    # Validate YouTube URL
    if not validate_youtube_url(request.url):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL"
        )

    try:
        # Extract metadata in thread pool
        loop = asyncio.get_event_loop()
        metadata = await loop.run_in_executor(thread_pool, extract_video_metadata, request.url)
        return metadata
    except DownloaderError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract metadata: {str(e)}")


@router.post("/upload-preview", response_model=UploadPreviewResponse)
async def upload_video_for_preview(
    file: UploadFile = File(...)
):
    """
    Upload a video file for preview in trimmer page.

    Does NOT start processing - just saves file and extracts metadata.
    Use process-upload/{job_id} to start processing after trimmer confirms.
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Save uploaded file
    upload_path = UPLOAD_DIR / f"{job_id}{file_ext}"

    try:
        # Read and save file
        content = await file.read()

        # Check file size
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_UPLOAD_SIZE / 1024 / 1024:.0f}MB"
            )

        with open(upload_path, 'wb') as f:
            f.write(content)

        # Extract metadata from uploaded file
        loop = asyncio.get_event_loop()
        metadata = await loop.run_in_executor(
            thread_pool,
            extract_local_video_metadata,
            str(upload_path),
            file.filename
        )

        # Set preview URL
        metadata.preview_url = f"/api/preview-upload/{job_id}"

    except HTTPException:
        raise
    except Exception as e:
        # Clean up on failure
        upload_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    # Create job entry (waiting for trimmer confirmation)
    jobs[job_id] = JobData(
        job_id=job_id,
        status=JobStatus.PENDING,
        progress=0,
        message="Waiting for trim/crop settings...",
        created_at=datetime.now(),
        video_path=str(upload_path),
        source_type="upload",
        original_filename=file.filename
    )

    return UploadPreviewResponse(
        job_id=job_id,
        metadata=metadata
    )


@router.get("/preview-upload/{job_id}")
async def preview_upload(job_id: str):
    """
    Stream uploaded video for preview in trimmer page.

    Used before processing starts, for trim/crop selection.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if not job.video_path or not Path(job.video_path).exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(
        path=job.video_path,
        media_type="video/mp4"
    )


@router.post("/process-upload/{job_id}", response_model=JobResponse)
async def process_uploaded_video(
    job_id: str,
    request: ProcessUploadRequest,
    background_tasks: BackgroundTasks
):
    """
    Start processing an already uploaded video with trim/crop settings.

    Called after trimmer page confirms settings.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if not job.video_path or not Path(job.video_path).exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    # Update job with trim/crop settings
    job.start_time = request.start_time
    job.end_time = request.end_time
    job.crop = request.crop

    # Start background task to process video
    async def process_with_settings():
        try:
            video_path = job.video_path
            loop = asyncio.get_event_loop()

            # Apply trim if specified
            if request.start_time is not None and request.end_time is not None:
                await update_job_status(job_id, JobStatus.PENDING, 5, "Trimming video...")
                from app.services.renderer import trim_video
                trimmed_path = await loop.run_in_executor(
                    thread_pool,
                    trim_video,
                    video_path,
                    request.start_time,
                    request.end_time,
                    job_id
                )
                job.video_path = trimmed_path
                video_path = trimmed_path

            # Apply crop if specified
            if request.crop:
                await update_job_status(job_id, JobStatus.PENDING, 10, "Applying crop...")
                from app.services.renderer import crop_video
                cropped_path = await loop.run_in_executor(
                    thread_pool,
                    crop_video,
                    video_path,
                    request.crop,
                    job_id
                )
                job.video_path = cropped_path
                video_path = cropped_path

            # Process video (transcribe + segment)
            await process_video_job(job_id, video_path)

        except Exception as e:
            job.error = str(e)
            await update_job_status(job_id, JobStatus.FAILED, 0, f"Processing failed: {str(e)}")

    background_tasks.add_task(process_with_settings)

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="Processing started..."
    )


@router.post("/process-url", response_model=JobResponse)
async def process_url(
    request: ProcessUrlRequest,
    background_tasks: BackgroundTasks
):
    """
    Process video from YouTube URL

    Returns job_id for status tracking
    """
    # Validate YouTube URL
    if not validate_youtube_url(request.url):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL"
        )

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Create job entry with trim/crop settings
    jobs[job_id] = JobData(
        job_id=job_id,
        status=JobStatus.DOWNLOADING,
        progress=0,
        message="Downloading video from YouTube...",
        created_at=datetime.now(),
        start_time=request.start_time,
        end_time=request.end_time,
        crop=request.crop,
        source_type="youtube"
    )

    # Start background task
    async def download_and_process():
        try:
            # Broadcast download start
            await update_job_status(job_id, JobStatus.DOWNLOADING, 5, "Downloading video from YouTube...")

            # Download video in thread pool with optional time range
            loop = asyncio.get_event_loop()
            video_path = await loop.run_in_executor(
                thread_pool,
                download_youtube,
                request.url,
                job_id,
                request.start_time,
                request.end_time
            )
            jobs[job_id].video_path = video_path
            await update_job_status(job_id, JobStatus.DOWNLOADING, 15, "Download completed")

            # Apply crop if specified
            if request.crop:
                from app.services.renderer import crop_video
                await update_job_status(job_id, JobStatus.DOWNLOADING, 18, "Applying crop...")
                cropped_path = await loop.run_in_executor(
                    thread_pool,
                    crop_video,
                    video_path,
                    request.crop,
                    job_id
                )
                jobs[job_id].video_path = cropped_path
                video_path = cropped_path

            # Process video
            await process_video_job(job_id, video_path)

        except DownloaderError as e:
            jobs[job_id].error = str(e)
            await update_job_status(job_id, JobStatus.FAILED, 0, f"Download failed: {str(e)}")
        except Exception as e:
            jobs[job_id].error = str(e)
            await update_job_status(job_id, JobStatus.FAILED, 0, f"Failed: {str(e)}")

    background_tasks.add_task(download_and_process)

    return JobResponse(
        job_id=job_id,
        status=JobStatus.DOWNLOADING,
        message="Downloading video..."
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_status(job_id: str):
    """
    Get job processing status
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    # Build download URL if completed
    download_url = None
    if job.status == JobStatus.COMPLETED and job.output_path:
        download_url = f"/api/download/{job_id}"

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        message=job.message,
        created_at=job.created_at,
        completed_at=job.completed_at,
        download_url=download_url
    )


@router.get("/preview/{job_id}")
async def preview_video(job_id: str):
    """
    Preview processed video without downloading

    Does NOT auto-cleanup - use for video playback
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Video processing not completed")

    if not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    # Return file for inline preview (no cleanup)
    return FileResponse(
        path=job.output_path,
        media_type="video/mp4"
    )


@router.get("/download/{job_id}")
async def download_video(job_id: str, background_tasks: BackgroundTasks):
    """
    Download processed video

    Automatically cleans up files after download
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Video processing not completed")

    if not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    # Schedule cleanup after download
    background_tasks.add_task(delete_job_files, job_id)
    background_tasks.add_task(lambda: jobs.pop(job_id, None))

    return FileResponse(
        path=job.output_path,
        filename=f"captioned_{job_id}.mp4",
        media_type="video/mp4"
    )


@router.get("/captions/{job_id}")
async def get_captions(job_id: str):
    """
    Retrieve captions for editing
    Returns JSON array of caption objects
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if not job.captions:
        raise HTTPException(status_code=400, detail="Captions not yet generated")

    return {
        "job_id": job_id,
        "captions": [caption.dict() for caption in job.captions],
        "total_segments": len(job.captions)
    }


@router.post("/captions/{job_id}")
async def update_captions(
    job_id: str,
    captions: list[Caption],
    background_tasks: BackgroundTasks
):
    """
    Accept edited captions and continue to rendering
    Validates timestamps, updates job, starts rendering
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job.status != JobStatus.EDITING:
        raise HTTPException(
            status_code=400,
            detail="Job not in editing state"
        )

    # Validate captions
    if not captions:
        raise HTTPException(status_code=400, detail="Captions cannot be empty")

    for i, cap in enumerate(captions):
        if cap.start >= cap.end:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timing in segment {i+1}: start >= end"
            )
        if cap.start < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timing in segment {i+1}: negative start time"
            )

    # Sort by start time
    captions.sort(key=lambda x: x.start)

    # Update job with edited captions
    job.captions = captions
    await update_job_status(job_id, JobStatus.RENDERING, 70, "Rendering video with captions...")

    # Start rendering in background
    background_tasks.add_task(render_video_with_captions, job_id)

    return {"status": "success", "message": "Rendering started"}


@router.post("/captions/{job_id}/skip")
async def skip_caption_editing(job_id: str, background_tasks: BackgroundTasks):
    """
    Skip editing and use original captions for rendering
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job.status != JobStatus.EDITING:
        raise HTTPException(status_code=400, detail="Job not in editing state")

    await update_job_status(job_id, JobStatus.RENDERING, 70, "Rendering video with captions...")
    background_tasks.add_task(render_video_with_captions, job_id)

    return {"status": "success", "message": "Rendering started"}


@router.websocket("/ws/status/{job_id}")
async def websocket_status(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time job status updates

    Clients connect and receive status updates whenever the job state changes
    """
    await manager.connect(websocket, job_id)

    try:
        # Send current status immediately on connection
        if job_id in jobs:
            job = jobs[job_id]
            await websocket.send_json({
                "job_id": job.job_id,
                "status": job.status,
                "progress": job.progress,
                "message": job.message,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "download_url": f"/api/download/{job_id}" if job.status == JobStatus.COMPLETED else None
            })
        else:
            await websocket.send_json({
                "error": "Job not found",
                "job_id": job_id
            })
            await websocket.close()
            return

        # Keep connection alive and wait for client disconnect
        while True:
            # Heartbeat mechanism: wait for ping from client
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # No ping received in 30 seconds, close connection
                break

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, job_id)
