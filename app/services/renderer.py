from typing import List
from pathlib import Path
import subprocess
from app.models import Caption, CropConfig
from app.config import (
    OUTPUT_DIR,
    TEMP_DIR,
    CAPTION_FONT,
    CAPTION_FONT_SIZE,
    CAPTION_FONT_COLOR,
    CAPTION_OUTLINE_COLOR,
    CAPTION_OUTLINE_WIDTH,
    CAPTION_SHADOW_OFFSET,
    CAPTION_MARGIN_V,
    CAPTION_ALIGNMENT,
    FFMPEG_VIDEO_CODEC,
    FFMPEG_AUDIO_CODEC,
    FFMPEG_PRESET,
    FFMPEG_CRF
)


class RendererError(Exception):
    """Custom exception for renderer errors"""
    pass


def generate_srt_file(captions: List[Caption], job_id: str) -> str:
    """
    Generate SRT subtitle file from captions

    Args:
        captions: List of Caption objects
        job_id: Job ID for naming the file

    Returns:
        Path to generated SRT file
    """
    srt_path = TEMP_DIR / f"{job_id}.srt"

    with open(srt_path, 'w', encoding='utf-8') as f:
        for i, caption in enumerate(captions, start=1):
            f.write(caption.to_srt_entry(i))
            f.write('\n')  # Blank line between entries

    return str(srt_path)


def burn_captions(video_path: str, captions: List[Caption], job_id: str) -> str:
    """
    Burn captions into video using FFmpeg

    Args:
        video_path: Path to input video
        captions: List of Caption objects
        job_id: Job ID for naming output file

    Returns:
        Path to output video with burned captions

    Raises:
        RendererError: If rendering fails
    """
    try:
        # Generate SRT file
        print("Generating SRT file...")
        srt_path = generate_srt_file(captions, job_id)

        # Output path
        output_path = OUTPUT_DIR / f"{job_id}_captioned.mp4"

        # Build subtitle style string with improved styling
        # force_style format: 'Key=Value,Key2=Value2'
        # Using ASS/SSA styling for better appearance
        style = (
            f"Alignment={CAPTION_ALIGNMENT},"
            f"MarginV={CAPTION_MARGIN_V},"
            f"FontSize={CAPTION_FONT_SIZE},"
            f"FontName={CAPTION_FONT},"
            f"PrimaryColour={CAPTION_FONT_COLOR},"
            f"OutlineColour={CAPTION_OUTLINE_COLOR},"
            f"Outline={CAPTION_OUTLINE_WIDTH},"
            f"Shadow={CAPTION_SHADOW_OFFSET},"
            f"Bold=1"
        )

        # Build FFmpeg command
        # Using subtitles filter to burn subtitles into video
        command = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f"subtitles={srt_path}:force_style='{style}'",
            '-c:v', FFMPEG_VIDEO_CODEC,
            '-preset', FFMPEG_PRESET,
            '-crf', str(FFMPEG_CRF),
            '-c:a', FFMPEG_AUDIO_CODEC,
            '-y',  # Overwrite output file
            str(output_path)
        ]

        print("Burning captions into video...")
        print(f"Command: {' '.join(command)}")

        # Run FFmpeg
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        if not output_path.exists():
            raise RendererError("Rendering completed but output file not found")

        # Clean up SRT file
        try:
            Path(srt_path).unlink()
        except:
            pass

        print(f"Video rendered successfully: {output_path}")
        return str(output_path)

    except subprocess.CalledProcessError as e:
        raise RendererError(f"FFmpeg rendering failed: {e.stderr}")
    except Exception as e:
        raise RendererError(f"Unexpected error during rendering: {str(e)}")


def get_video_info(video_path: str) -> dict:
    """
    Get video information using ffprobe

    Args:
        video_path: Path to video file

    Returns:
        Dictionary with video info (duration, width, height, etc.)
    """
    try:
        command = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            video_path
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        import json
        return json.loads(result.stdout)

    except Exception as e:
        print(f"Warning: Could not get video info: {e}")
        return {}


def trim_video(video_path: str, start_time: float, end_time: float, job_id: str) -> str:
    """
    Trim video to specified time range using FFmpeg.

    Args:
        video_path: Path to input video
        start_time: Start time in seconds
        end_time: End time in seconds
        job_id: Job ID for naming output file

    Returns:
        Path to trimmed video

    Raises:
        RendererError: If trimming fails
    """
    try:
        output_path = TEMP_DIR / f"{job_id}_trimmed.mp4"

        duration = end_time - start_time
        print(f"Trimming video: {start_time}s to {end_time}s (duration: {duration}s)")

        # FFmpeg trim: -ss for start, -t for duration
        command = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', video_path,
            '-t', str(duration),
            '-c:v', FFMPEG_VIDEO_CODEC,
            '-preset', 'fast',
            '-crf', str(FFMPEG_CRF),
            '-c:a', 'aac',  # Re-encode audio to avoid sync issues
            '-y',
            str(output_path)
        ]

        print(f"Trim command: {' '.join(command)}")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        if not output_path.exists():
            raise RendererError("Trimming completed but output file not found")

        # Remove original file to save space
        try:
            Path(video_path).unlink()
        except:
            pass

        print(f"Video trimmed successfully: {output_path}")
        return str(output_path)

    except subprocess.CalledProcessError as e:
        raise RendererError(f"FFmpeg trimming failed: {e.stderr}")
    except Exception as e:
        raise RendererError(f"Unexpected error during trimming: {str(e)}")


def crop_video(video_path: str, crop_config: CropConfig, job_id: str) -> str:
    """
    Crop video using FFmpeg.

    Args:
        video_path: Path to input video
        crop_config: CropConfig with x, y, width, height
        job_id: Job ID for naming output file

    Returns:
        Path to cropped video

    Raises:
        RendererError: If cropping fails
    """
    try:
        output_path = TEMP_DIR / f"{job_id}_cropped.mp4"

        # Calculate crop parameters
        x = crop_config.x
        y = crop_config.y
        w = crop_config.width
        h = crop_config.height

        print(f"Cropping video: {w}x{h} at ({x}, {y})")

        # FFmpeg crop filter: crop=w:h:x:y
        command = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f'crop={w}:{h}:{x}:{y}',
            '-c:v', FFMPEG_VIDEO_CODEC,
            '-preset', 'fast',  # Use fast preset for quicker cropping
            '-crf', str(FFMPEG_CRF),
            '-c:a', 'copy',  # Copy audio without re-encoding
            '-y',
            str(output_path)
        ]

        print(f"Crop command: {' '.join(command)}")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        if not output_path.exists():
            raise RendererError("Cropping completed but output file not found")

        # Optionally remove original file to save space
        try:
            Path(video_path).unlink()
        except:
            pass

        print(f"Video cropped successfully: {output_path}")
        return str(output_path)

    except subprocess.CalledProcessError as e:
        raise RendererError(f"FFmpeg cropping failed: {e.stderr}")
    except Exception as e:
        raise RendererError(f"Unexpected error during cropping: {str(e)}")
