import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp"
UPLOAD_DIR = TEMP_DIR / "uploads"
DOWNLOAD_DIR = TEMP_DIR / "downloads"
OUTPUT_DIR = TEMP_DIR / "outputs"

# Create temp directories if they don't exist
TEMP_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
DOWNLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Transcription provider: "local" (faster-whisper) or "replicate" (cloud API)
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "local")

# Local Whisper settings (used when TRANSCRIPTION_PROVIDER=local)
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # base, small, medium, large
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")  # cpu or cuda
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # int8, float16, float32

# Replicate settings (used when TRANSCRIPTION_PROVIDER=replicate)
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
REPLICATE_WHISPER_MODEL = os.getenv("REPLICATE_WHISPER_MODEL", "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c")

# File upload settings
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

# Caption segmentation settings (word-based for short, readable captions)
CAPTION_MAX_WORDS_PER_LINE = 4     # Max 4 words per line (shorter chunks)
CAPTION_MIN_WORDS_PER_LINE = 2     # Min 2 words per line
CAPTION_MAX_LINES = 1              # Single line only (no stacking)
CAPTION_MAX_DURATION = 2.5         # Max 2.5 seconds per chunk
CAPTION_MIN_DURATION = 0.5         # Min 0.5 second per chunk

# Caption styling (for FFmpeg ASS/SSA format)
CAPTION_FONT = "Open Sans"         # Clean sans-serif font
CAPTION_FONT_SIZE = 18             # Smaller, cleaner (was 32)
CAPTION_FONT_COLOR = "&HFFFFFF"    # White
CAPTION_OUTLINE_COLOR = "&H000000" # Black outline
CAPTION_OUTLINE_WIDTH = 1          # Thinner outline (1px)
CAPTION_SHADOW_OFFSET = 1          # Subtle shadow for depth
CAPTION_MARGIN_V = 80              # Higher position (like the green reference)
CAPTION_ALIGNMENT = 2              # 2 = bottom center

# FFmpeg encoding settings
FFMPEG_VIDEO_CODEC = "libx264"
FFMPEG_AUDIO_CODEC = "copy"  # Copy audio without re-encoding
FFMPEG_PRESET = "medium"  # ultrafast, fast, medium, slow
FFMPEG_CRF = 23  # Quality (lower = better, 18-28 is good range)

# Cleanup settings
CLEANUP_AGE_HOURS = 24  # Delete files older than 24 hours

# Bad word filter settings
# Disabled on backend - frontend handles censoring with user choice
BAD_WORD_FILTER_ENABLED = False
BAD_WORDS = {
    # English profanity
    "fuck", "fucking", "fucked", "fucker", "fucks",
    "shit", "shitting", "shitty",
    "bitch", "bitches", "bitching",
    "ass", "asshole", "asses",
    "damn", "damned", "dammit",
    "hell",
    "crap",
    "dick", "dicks",
    "cock", "cocks",
    "pussy", "pussies",
    "bastard", "bastards",
    "slut", "sluts",
    "whore", "whores",
    "cunt", "cunts",
    # Add more as needed
}
