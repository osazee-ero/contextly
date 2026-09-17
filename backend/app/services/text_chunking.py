def clean_text(text: str) -> str:
    return " ".join(text.split())


def split_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> list[str]:
    text = clean_text(text)

    if not text:
        return []

    if chunk_size <= overlap:
        raise ValueError(
            "chunk_size must be larger than overlap."
        )

    chunks: list[str] = []

    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(
            start + chunk_size,
            text_length,
        )

        if end < text_length:
            boundary = text.rfind(
                " ",
                start,
                end,
            )

            if boundary > start:
                end = boundary

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        start = max(
            end - overlap,
            start + 1,
        )

    return chunks