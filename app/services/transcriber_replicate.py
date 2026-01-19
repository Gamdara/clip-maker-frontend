"""
Replicate-based transcription service using incredibly-fast-whisper.
Used in production to offload GPU-intensive transcription to cloud.
"""
import replicate
import tempfile
import os
from typing import List
from pathlib import Path
from app.config import REPLICATE_API_TOKEN, REPLICATE_WHISPER_MODEL, TEMP_DIR
from app.models import WordTimestamp


class ReplicateTranscriberError(Exception):
    """Custom exception for Replicate transcriber errors"""
    pass


def transcribe_with_replicate(audio_path: str) -> List[WordTimestamp]:
    """
    Transcribe audio using Replicate's incredibly-fast-whisper API.

    Args:
        audio_path: Path to audio file (WAV format)

    Returns:
        List of WordTimestamp objects

    Raises:
        ReplicateTranscriberError: If transcription fails
    """
    if not REPLICATE_API_TOKEN:
        raise ReplicateTranscriberError(
            "REPLICATE_API_TOKEN not set. Please set the environment variable."
        )

    # Set API token
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    try:
        print(f"Uploading audio to Replicate...")

        # Read audio file and upload
        with open(audio_path, "rb") as audio_file:
            # Run the model
            print(f"Running Replicate Whisper model: {REPLICATE_WHISPER_MODEL}")
            output = replicate.run(
                REPLICATE_WHISPER_MODEL,
                input={
                    "audio": audio_file,
                    "task": "transcribe",
                    "timestamp": "word",  # Get word-level timestamps
                    "batch_size": 64,
                }
            )

        print(f"Replicate transcription complete")

        # Parse the output
        words = []

        # The output format from incredibly-fast-whisper:
        # {
        #   "text": "full transcription text",
        #   "chunks": [
        #     {"text": "word", "timestamp": [start, end]},
        #     ...
        #   ]
        # }

        if isinstance(output, dict):
            chunks = output.get("chunks", [])

            for chunk in chunks:
                word_text = chunk.get("text", "").strip()
                timestamp = chunk.get("timestamp", [0, 0])

                if word_text and len(timestamp) >= 2:
                    start = float(timestamp[0]) if timestamp[0] is not None else 0.0
                    end = float(timestamp[1]) if timestamp[1] is not None else start + 0.1

                    words.append(WordTimestamp(
                        word=word_text,
                        start=start,
                        end=end
                    ))

        print(f"Parsed {len(words)} words from Replicate response")
        return words

    except replicate.exceptions.ReplicateError as e:
        raise ReplicateTranscriberError(f"Replicate API error: {str(e)}")
    except Exception as e:
        raise ReplicateTranscriberError(f"Replicate transcription failed: {str(e)}")
