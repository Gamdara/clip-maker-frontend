from typing import List
import subprocess
import re
from pathlib import Path
from app.config import (
    WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE, TEMP_DIR,
    BAD_WORD_FILTER_ENABLED, BAD_WORDS, TRANSCRIPTION_PROVIDER
)
from app.models import WordTimestamp


def censor_word(word: str) -> str:
    """
    Censor a bad word by keeping first letter and replacing rest with *.
    Preserves trailing punctuation.

    Examples:
        "fuck" -> "f***"
        "shit." -> "s***."
        "fucking," -> "f******,"
    """
    if not BAD_WORD_FILTER_ENABLED:
        return word

    # Extract trailing punctuation
    punct = ""
    base_word = word
    while base_word and base_word[-1] in '.,!?;:':
        punct = base_word[-1] + punct
        base_word = base_word[:-1]

    # Check if base word (lowercase) is in bad words list
    if base_word.lower() in BAD_WORDS:
        if len(base_word) <= 1:
            return "*" + punct
        # Keep first letter, replace rest with *
        censored = base_word[0] + "*" * (len(base_word) - 1)
        return censored + punct

    return word


class TranscriberError(Exception):
    """Custom exception for transcriber errors"""
    pass


# Global model instance (loaded once, only for local provider)
_model = None


def get_whisper_model():
    """
    Get or initialize Whisper model (singleton pattern)
    Only used when TRANSCRIPTION_PROVIDER=local

    Returns:
        WhisperModel instance
    """
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        print(f"Loading Whisper model: {WHISPER_MODEL} on {WHISPER_DEVICE}")
        _model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE
        )
        print("Whisper model loaded successfully")
    return _model


def extract_audio(video_path: str) -> str:
    """
    Extract audio from video file using FFmpeg

    Args:
        video_path: Path to video file

    Returns:
        Path to extracted audio file (WAV format)

    Raises:
        TranscriberError: If audio extraction fails
    """
    video_file = Path(video_path)
    audio_path = TEMP_DIR / f"{video_file.stem}_audio.wav"

    try:
        # Extract audio as WAV (Whisper works best with WAV)
        command = [
            'ffmpeg',
            '-i', str(video_path),
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM 16-bit
            '-ar', '16000',  # 16kHz sample rate (Whisper's native rate)
            '-ac', '1',  # Mono
            '-y',  # Overwrite output file
            str(audio_path)
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        if not audio_path.exists():
            raise TranscriberError("Audio extraction completed but file not found")

        return str(audio_path)

    except subprocess.CalledProcessError as e:
        raise TranscriberError(f"FFmpeg audio extraction failed: {e.stderr}")
    except Exception as e:
        raise TranscriberError(f"Unexpected error during audio extraction: {str(e)}")


def transcribe_audio(video_path: str) -> List[WordTimestamp]:
    """
    Transcribe audio from video with word-level timestamps.

    Uses either local Whisper or Replicate API based on TRANSCRIPTION_PROVIDER config.

    Args:
        video_path: Path to video file

    Returns:
        List of WordTimestamp objects (with punctuation preserved)

    Raises:
        TranscriberError: If transcription fails
    """
    try:
        # Extract audio first (needed for both providers)
        print("Extracting audio from video...")
        audio_path = extract_audio(video_path)

        # Choose transcription provider
        if TRANSCRIPTION_PROVIDER == "replicate":
            words = _transcribe_with_replicate(audio_path)
        else:
            words = _transcribe_with_local(audio_path)

        print(f"Transcribed {len(words)} words using {TRANSCRIPTION_PROVIDER} provider")

        # Clean up audio file
        try:
            Path(audio_path).unlink()
        except:
            pass

        return words

    except TranscriberError:
        raise
    except Exception as e:
        raise TranscriberError(f"Transcription failed: {str(e)}")


def _transcribe_with_replicate(audio_path: str) -> List[WordTimestamp]:
    """
    Transcribe using Replicate API (cloud GPU).
    """
    from app.services.transcriber_replicate import transcribe_with_replicate, ReplicateTranscriberError

    print(f"Using Replicate API for transcription...")

    try:
        words = transcribe_with_replicate(audio_path)

        # Apply bad word filter to Replicate results
        for word in words:
            word.word = censor_word(word.word)

        return words
    except ReplicateTranscriberError as e:
        raise TranscriberError(str(e))


def _transcribe_with_local(audio_path: str) -> List[WordTimestamp]:
    """
    Transcribe using local faster-whisper model.
    """
    print(f"Using local Whisper model for transcription...")

    # Get Whisper model
    model = get_whisper_model()

    # Transcribe with word timestamps
    print("Transcribing audio...")
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        language=None,  # Auto-detect language
        vad_filter=True,  # Voice activity detection
    )

    print(f"Detected language: {info.language} (probability: {info.language_probability:.2f})")

    # Extract word-level timestamps with punctuation from segment text
    words = []
    for segment in segments:
        if hasattr(segment, 'words') and segment.words:
            # Get the full segment text (has punctuation)
            segment_text = segment.text.strip()

            # Debug: print segment info
            print(f"\n[DEBUG] Segment text: {segment_text}")

            # Build a mapping: for each word position, find punctuation that follows it
            # We'll parse the segment text to extract words with their trailing punctuation
            segment_words_with_punct = []
            current_word = ""
            for char in segment_text:
                if char.isalnum() or char == "'":  # Part of a word (including apostrophes)
                    current_word += char
                elif current_word:  # End of word, char might be punctuation or space
                    if char in '.,!?;:':
                        segment_words_with_punct.append(current_word + char)
                    else:
                        segment_words_with_punct.append(current_word)
                    current_word = ""
            # Don't forget the last word
            if current_word:
                segment_words_with_punct.append(current_word)

            print(f"[DEBUG] Parsed words with punct: {segment_words_with_punct}")

            # Match with word timestamps
            word_objs = list(segment.words)
            print(f"[DEBUG] Whisper word objs: {[w.word.strip() for w in word_objs]}")

            for i, word_obj in enumerate(word_objs):
                word_text = word_obj.word.strip()

                # Try to find matching word in our parsed list
                if i < len(segment_words_with_punct):
                    parsed_word = segment_words_with_punct[i]
                    # Check if the base word matches (ignoring case and punctuation)
                    base_parsed = ''.join(c for c in parsed_word if c.isalnum() or c == "'")
                    if base_parsed.lower() == word_text.lower():
                        word_text = parsed_word

                # Apply bad word filter (keeps first letter, censors rest)
                word_text = censor_word(word_text)

                words.append(WordTimestamp(
                    word=word_text,
                    start=word_obj.start,
                    end=word_obj.end
                ))

            print(f"[DEBUG] Final words: {[w.word for w in words[-len(word_objs):]]}")

    return words
