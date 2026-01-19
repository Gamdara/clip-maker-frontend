# Caption Generator Backend

Automatic video caption generation using speech-to-text (Whisper) and FFmpeg.

## Features

- Upload video files or provide YouTube URLs
- Automatic speech transcription with word-level timestamps
- Intelligent caption segmentation (max 2 lines, proper breaks)
- Hardcoded captions burned into video (bottom-center)
- Background job processing
- RESTful API with FastAPI

## Requirements

- Python 3.8+
- FFmpeg installed on system
- 2GB+ RAM (for Whisper model)

## Installation

### 1. Install System Dependencies

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download FFmpeg from https://ffmpeg.org/download.html and add to PATH

### 2. Setup Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. First Run (Download Whisper Model)

On first run, faster-whisper will automatically download the model (~140MB for 'base' model).

## Usage

### Start the Server

```bash
# From backend directory
python -m uvicorn app.main:app --reload

# Or run directly
python app/main.py
```

Server will start at: `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

### API Endpoints

#### 1. Upload Video File
```bash
POST /api/upload
Content-Type: multipart/form-data

# Example with curl:
curl -X POST http://localhost:8000/api/upload \
  -F "file=@video.mp4"

# Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Video uploaded successfully"
}
```

#### 2. Process YouTube URL
```bash
POST /api/process-url
Content-Type: application/json

# Example:
curl -X POST http://localhost:8000/api/process-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=..."}'

# Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "downloading",
  "message": "Downloading video..."
}
```

#### 3. Check Job Status
```bash
GET /api/status/{job_id}

# Example:
curl http://localhost:8000/api/status/550e8400-e29b-41d4-a716-446655440000

# Response:
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "message": "Processing completed",
  "download_url": "/api/download/550e8400-e29b-41d4-a716-446655440000"
}
```

#### 4. Download Processed Video
```bash
GET /api/download/{job_id}

# Example:
curl -O -J http://localhost:8000/api/download/550e8400-e29b-41d4-a716-446655440000
```

### Job Status Flow

1. `pending` - Video uploaded, queued for processing
2. `downloading` - Downloading from YouTube (URL uploads only)
3. `transcribing` - Extracting audio and transcribing speech
4. `rendering` - Burning captions into video
5. `completed` - Ready for download
6. `failed` - Error occurred (check message for details)

## Configuration

Edit [app/config.py](app/config.py) to customize:

- **Whisper Model**: `base`, `small`, `medium`, `large` (larger = better accuracy, slower)
- **Caption Styling**: Font, size, color, position
- **Max Upload Size**: Default 500MB
- **FFmpeg Encoding**: Quality settings (CRF, preset)

Example:
```python
# Use larger Whisper model for better accuracy
WHISPER_MODEL = "medium"

# Increase font size
CAPTION_FONT_SIZE = 28

# Adjust caption position (pixels from bottom)
CAPTION_MARGIN_V = 80
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Configuration
│   ├── models.py            # Pydantic models
│   ├── routes/
│   │   └── video.py         # API endpoints
│   ├── services/
│   │   ├── downloader.py    # YouTube download
│   │   ├── transcriber.py   # Whisper transcription
│   │   ├── segmenter.py     # Caption segmentation
│   │   └── renderer.py      # FFmpeg rendering
│   └── utils/
│       └── file_manager.py  # File cleanup
├── temp/                    # Temporary files (auto-created)
├── requirements.txt
└── README.md
```

## Troubleshooting

### FFmpeg not found
```
Error: ffmpeg: command not found
```
Solution: Install FFmpeg (see Installation section)

### Whisper model download fails
```
Error: Cannot download model
```
Solution: Check internet connection, or manually download model from Hugging Face

### Out of memory
```
Error: CUDA out of memory / System memory exceeded
```
Solution: Use smaller Whisper model (`base` instead of `medium`/`large`)

### YouTube download fails
```
Error: Failed to download video
```
Solution: Update yt-dlp: `pip install --upgrade yt-dlp`

## Development

### Run with auto-reload
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Environment Variables
```bash
# Optional environment variables
export WHISPER_MODEL=base
export WHISPER_DEVICE=cpu
export WHISPER_COMPUTE_TYPE=int8
```

### Testing
```bash
# Upload a test video
curl -X POST http://localhost:8000/api/upload -F "file=@test.mp4"

# Process YouTube video
curl -X POST http://localhost:8000/api/process-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Performance

- **Base model**: ~1-2x realtime (5 min video = 5-10 min processing)
- **Small model**: ~2-3x realtime (better accuracy)
- **Medium model**: ~4-6x realtime (best accuracy for most cases)

Processing time includes:
- Audio extraction: ~10s
- Transcription: 1-5x realtime (depends on model)
- Caption generation: <1s
- Video rendering: 0.5-2x realtime

## License

MIT
