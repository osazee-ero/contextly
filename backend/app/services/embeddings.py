from openai import OpenAI

from app.core.config import settings


client = OpenAI(
    api_key=settings.openai_api_key,
    timeout=20.0,
    max_retries=1,
)


def embed_text(text: str) -> list[float]:
    response = client.with_options(timeout=10.0, max_retries=0).embeddings.create(
        model=settings.openai_embedding_model,
        input=text,
    )

    return response.data[0].embedding


def embed_texts(
    texts: list[str],
) -> list[list[float]]:
    if not texts:
        return []

    embeddings = []
    for offset in range(0, len(texts), 64):
        batch = texts[offset:offset + 64]
        response = client.embeddings.create(
            model=settings.openai_embedding_model, input=batch,
        )
        ordered = sorted(response.data, key=lambda item: item.index)
        if len(ordered) != len(batch):
            raise RuntimeError("Embedding service returned an incomplete batch.")
        embeddings.extend(item.embedding for item in ordered)
    return embeddings
