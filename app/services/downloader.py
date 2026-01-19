import yt_dlp
import re
from pathlib import Path
from typing import Optional
import uuid
from app.config import DOWNLOAD_DIR
from app.models import VideoMetadata


class DownloaderError(Exception):
    """Custom exception for downloader errors"""
    pass


def extract_video_metadata(url: str) -> VideoMetadata:
    """
    Extract video metadata from YouTube URL without downloading.

    Args:
        url: YouTube video URL

    Returns:
        VideoMetadata object with title, duration, dimensions, etc.

    Raises:
        DownloaderError: If extraction fails
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Extracting metadata from: {url}")
            info = ydl.extract_info(url, download=False)

            video_id = info.get('id', '')
            duration = info.get('duration', 0)
            width = info.get('width', 1920)
            height = info.get('height', 1080)

            # Try to get actual dimensions from format
            if info.get('formats'):
                for fmt in reversed(info['formats']):
                    if fmt.get('width') and fmt.get('height'):
                        width = fmt['width']
                        height = fmt['height']
                        break

            return VideoMetadata(
                title=info.get('title', 'Untitled'),
                duration=float(duration) if duration else 0.0,
                width=width or 1920,
                height=height or 1080,
                thumbnail_url=info.get('thumbnail', ''),
                embed_url=f"https://www.youtube.com/embed/{video_id}",
                video_id=video_id,
                source_type="youtube"
            )

    except yt_dlp.utils.DownloadError as e:
        raise DownloaderError(f"Failed to extract metadata: {str(e)}")
    except Exception as e:
        raise DownloaderError(f"Unexpected error extracting metadata: {str(e)}")


def download_youtube(
    url: str,
    job_id: Optional[str] = None,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None
) -> str:
    """
    Download video from YouTube URL with optional time range.

    Args:
        url: YouTube video URL
        job_id: Optional job ID for naming the file
        start_time: Optional start time in seconds for partial download
        end_time: Optional end time in seconds for partial download

    Returns:
        Path to downloaded video file

    Raises:
        DownloaderError: If download fails
    """
    if job_id is None:
        job_id = str(uuid.uuid4())

    output_path = DOWNLOAD_DIR / f"{job_id}.mp4"

    # Output without extension - yt-dlp will add it
    output_template = DOWNLOAD_DIR / job_id

    ydl_opts = {
        # Download best available quality (works with HLS/m3u8)
        'format': 'bv*+ba/b',  # best video + best audio, or best combined
        'outtmpl': str(output_template),  # yt-dlp will add extension
        'quiet': False,
        'no_warnings': False,
        'merge_output_format': 'mp4',  # Force merge to mp4
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',  # Convert to mp4 if needed
        }],
    }

    # Add time range if specified (partial download)
    if start_time is not None and end_time is not None:
        # Format as *start-end for download_ranges
        # yt-dlp uses format like "*0:00-1:30" or "*0-90" (seconds)
        ydl_opts['download_ranges'] = lambda info_dict, ydl: [
            {'start_time': start_time, 'end_time': end_time}
        ]
        ydl_opts['force_keyframes_at_cuts'] = True
        print(f"Downloading time range: {start_time}s to {end_time}s")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading video from: {url}")
            info = ydl.extract_info(url, download=True)

            # After download, the merged file should be at output_path
            if output_path.exists() and output_path.stat().st_size > 0:
                print(f"Downloaded successfully: {output_path}")
                return str(output_path)
            else:
                # Check if file exists with requested_downloads
                if 'requested_downloads' in info and info['requested_downloads']:
                    downloaded_file = info['requested_downloads'][0]['filepath']
                    if Path(downloaded_file).exists():
                        return downloaded_file

                raise DownloaderError("Download completed but file not found or empty")

    except yt_dlp.utils.DownloadError as e:
        raise DownloaderError(f"Failed to download video: {str(e)}")
    except Exception as e:
        raise DownloaderError(f"Unexpected error during download: {str(e)}")


def validate_youtube_url(url: str) -> bool:
    """
    Validate if URL is a valid YouTube URL

    Args:
        url: URL to validate

    Returns:
        True if valid YouTube URL, False otherwise
    """
    youtube_domains = [
        'youtube.com',
        'www.youtube.com',
        'youtu.be',
        'm.youtube.com'
    ]

    return any(domain in url.lower() for domain in youtube_domains)
