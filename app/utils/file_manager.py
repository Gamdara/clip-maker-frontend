from pathlib import Path
from datetime import datetime, timedelta
from typing import List
from app.config import TEMP_DIR, UPLOAD_DIR, DOWNLOAD_DIR, OUTPUT_DIR, CLEANUP_AGE_HOURS
import shutil


def cleanup_old_files(age_hours: int = CLEANUP_AGE_HOURS):
    """
    Delete files older than specified hours from temp directories

    Args:
        age_hours: Age in hours after which files should be deleted
    """
    cutoff_time = datetime.now() - timedelta(hours=age_hours)

    directories = [UPLOAD_DIR, DOWNLOAD_DIR, OUTPUT_DIR, TEMP_DIR]
    deleted_count = 0

    for directory in directories:
        if not directory.exists():
            continue

        for file_path in directory.iterdir():
            if file_path.is_file():
                # Get file modification time
                file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

                if file_mtime < cutoff_time:
                    try:
                        file_path.unlink()
                        deleted_count += 1
                        print(f"Deleted old file: {file_path.name}")
                    except Exception as e:
                        print(f"Error deleting {file_path}: {e}")

    print(f"Cleanup completed: {deleted_count} files deleted")
    return deleted_count


def delete_job_files(job_id: str):
    """
    Delete all files associated with a job

    Args:
        job_id: Job ID
    """
    patterns = [
        f"{job_id}*",
        f"*{job_id}*"
    ]

    directories = [UPLOAD_DIR, DOWNLOAD_DIR, OUTPUT_DIR, TEMP_DIR]
    deleted_files = []

    for directory in directories:
        if not directory.exists():
            continue

        for file_path in directory.iterdir():
            if file_path.is_file() and job_id in file_path.name:
                try:
                    file_path.unlink()
                    deleted_files.append(str(file_path))
                    print(f"Deleted job file: {file_path.name}")
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}")

    return deleted_files


def get_temp_dir_size() -> dict:
    """
    Get size of all temp directories

    Returns:
        Dictionary with directory sizes in bytes
    """
    sizes = {}

    directories = {
        'upload': UPLOAD_DIR,
        'download': DOWNLOAD_DIR,
        'output': OUTPUT_DIR,
        'temp': TEMP_DIR
    }

    for name, directory in directories.items():
        if not directory.exists():
            sizes[name] = 0
            continue

        total_size = 0
        for file_path in directory.rglob('*'):
            if file_path.is_file():
                total_size += file_path.stat().st_size

        sizes[name] = total_size

    sizes['total'] = sum(sizes.values())
    return sizes


def ensure_directories_exist():
    """
    Ensure all required directories exist
    """
    directories = [TEMP_DIR, UPLOAD_DIR, DOWNLOAD_DIR, OUTPUT_DIR]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

    print("All required directories verified")


def format_size(bytes_size: int) -> str:
    """
    Format byte size to human-readable string

    Args:
        bytes_size: Size in bytes

    Returns:
        Formatted string (e.g., "1.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"
