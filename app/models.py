from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from enum import Enum
from datetime import datetime


class JobStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    EDITING = "editing"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class CropConfig(BaseModel):
    """Crop configuration for video processing"""
    x: int = Field(..., description="Left offset in pixels")
    y: int = Field(..., description="Top offset in pixels")
    width: int = Field(..., description="Crop width in pixels")
    height: int = Field(..., description="Crop height in pixels")
    source_width: int = Field(..., description="Original video width")
    source_height: int = Field(..., description="Original video height")


class VideoMetadata(BaseModel):
    """Video metadata extracted without downloading"""
    title: str
    duration: float  # seconds
    width: int
    height: int
    thumbnail_url: str
    embed_url: Optional[str] = None  # YouTube embed URL
    video_id: Optional[str] = None  # YouTube video ID
    preview_url: Optional[str] = None  # For uploaded files
    source_type: str = "youtube"  # "youtube" or "upload"


class ExtractMetadataRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL")


class ProcessUrlRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL")
    start_time: Optional[float] = Field(None, description="Trim start time in seconds")
    end_time: Optional[float] = Field(None, description="Trim end time in seconds")
    crop: Optional[CropConfig] = Field(None, description="Crop configuration")


class ProcessUploadRequest(BaseModel):
    start_time: Optional[float] = Field(None, description="Trim start time in seconds")
    end_time: Optional[float] = Field(None, description="Trim end time in seconds")
    crop: Optional[CropConfig] = Field(None, description="Crop configuration")


class UploadPreviewResponse(BaseModel):
    job_id: str = Field(..., description="Unique job identifier")
    metadata: VideoMetadata = Field(..., description="Video metadata")


class JobResponse(BaseModel):
    job_id: str = Field(..., description="Unique job identifier")
    status: JobStatus = Field(..., description="Current job status")
    message: Optional[str] = Field(None, description="Status message or error")


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(..., ge=0, le=100, description="Progress percentage")
    message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    download_url: Optional[str] = None


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float


class Caption(BaseModel):
    text: str
    start: float
    end: float

    def to_srt_time(self, seconds: float) -> str:
        """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def to_srt_entry(self, index: int) -> str:
        """Convert caption to SRT format entry"""
        start_time = self.to_srt_time(self.start)
        end_time = self.to_srt_time(self.end)
        return f"{index}\n{start_time} --> {end_time}\n{self.text}\n"


class JobData(BaseModel):
    """Internal job data structure"""
    job_id: str
    status: JobStatus
    progress: int = 0
    message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    video_path: Optional[str] = None
    output_path: Optional[str] = None
    error: Optional[str] = None
    captions: Optional[List[Caption]] = None
    srt_path: Optional[str] = None
    # Trim/crop settings
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    crop: Optional[CropConfig] = None
    # Source info
    source_type: str = "youtube"  # "youtube" or "upload"
    original_filename: Optional[str] = None
