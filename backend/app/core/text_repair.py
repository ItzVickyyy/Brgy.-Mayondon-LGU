"""Repair text that was decoded with the wrong encoding ("Los BaÃ±os")."""

_MARKERS = ("Ã", "Â", "â€")


def fix_mojibake(text: str) -> str:
    """Return `text` with UTF-8 that was read as Windows-1252/Latin-1 undone.

    Text without the telltale characters, or text that does not round-trip
    cleanly, comes back unchanged, so it is safe to call on any string.
    """
    if not any(marker in text for marker in _MARKERS):
        return text
    for encoding in ("cp1252", "latin-1"):
        try:
            return text.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return text
