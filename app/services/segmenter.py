from typing import List
from app.models import WordTimestamp, Caption
from app.config import (
    CAPTION_MAX_WORDS_PER_LINE,
    CAPTION_MIN_WORDS_PER_LINE,
    CAPTION_MAX_LINES,
    CAPTION_MAX_DURATION,
    CAPTION_MIN_DURATION
)


def segment_captions(words: List[WordTimestamp]) -> List[Caption]:
    """
    Segment words into short, readable caption chunks.

    Rules:
    - Max 4 words per caption (single line)
    - 0.5–2.5 seconds per chunk
    - ALWAYS break on sentence end (., !, ?) - one sentence per segment
    - Break on natural pauses (commas, speech gaps) when at good length

    Args:
        words: List of WordTimestamp objects from transcription

    Returns:
        List of Caption objects with formatted text
    """
    if not words:
        return []

    max_words = CAPTION_MAX_WORDS_PER_LINE  # 4 words max per caption
    captions = []
    current_words = []

    # Punctuation that indicates sentence end - ALWAYS break here
    sentence_end = {'.', '!', '?'}
    # Punctuation that indicates pause - break if at good length
    pause_punct = {',', ';', ':'}

    for i, word in enumerate(words):
        current_words.append(word)
        word_count = len(current_words)
        duration = word.end - current_words[0].start if current_words else 0
        word_text = word.word.rstrip()

        should_break = False

        # 1. ALWAYS break on sentence end - one sentence per segment
        if any(word_text.endswith(p) for p in sentence_end):
            should_break = True

        # 2. Force break if max duration exceeded
        elif duration >= CAPTION_MAX_DURATION:
            should_break = True

        # 3. Force break if max words exceeded
        elif word_count >= max_words:
            should_break = True

        # 4. Break on pause punctuation at good length
        elif word_count >= CAPTION_MIN_WORDS_PER_LINE and duration >= CAPTION_MIN_DURATION:
            if any(word_text.endswith(p) for p in pause_punct):
                should_break = True

        # 5. Break on speech gap (>300ms pause to next word)
        if not should_break and word_count >= CAPTION_MIN_WORDS_PER_LINE:
            if i + 1 < len(words):
                gap = words[i + 1].start - word.end
                if gap > 0.3:  # 300ms pause indicates natural break
                    should_break = True

        if should_break and current_words:
            caption = create_caption_from_words(current_words)
            captions.append(caption)
            current_words = []

    # Add remaining words as final caption
    if current_words:
        caption = create_caption_from_words(current_words)
        captions.append(caption)

    # Post-process: format captions (single line mode)
    return [format_single_line(cap) for cap in captions]


def create_caption_from_words(words: List[WordTimestamp]) -> Caption:
    """
    Create a Caption object from a list of words.

    Args:
        words: List of WordTimestamp objects

    Returns:
        Caption object with text and timing
    """
    text = ' '.join(w.word for w in words)
    return Caption(
        text=text,
        start=words[0].start,
        end=words[-1].end
    )


def format_single_line(caption: Caption) -> Caption:
    """
    Keep caption as single line (no splitting).

    With CAPTION_MAX_LINES = 1, we just return the caption as-is.
    The segmentation algorithm already limits word count.

    Args:
        caption: Caption object to format

    Returns:
        Caption with single line text
    """
    # Just return as-is - segmentation already handles word limits
    return caption
