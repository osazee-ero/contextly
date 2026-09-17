# import uuid
# from dataclasses import dataclass

# from sqlalchemy import select
# from sqlalchemy.orm import Session

# from app.models.document import Document
# from app.models.document_chunk import DocumentChunk
# from app.services.embeddings import embed_text


# @dataclass
# class RetrievalResult:
#     chunk_id: uuid.UUID
#     document_id: uuid.UUID
#     filename: str
#     page_number: int
#     content: str
#     distance: float


# def retrieve_chunks(
#     db: Session,
#     user_id: uuid.UUID,
#     query: str,
#     limit: int = 5,
# ) -> list[RetrievalResult]:
#     query_embedding = embed_text(query)

#     distance = (
#         DocumentChunk.embedding.cosine_distance(
#             query_embedding
#         )
#     )

#     rows = db.execute(
#         select(
#             DocumentChunk,
#             Document,
#             distance.label("distance"),
#         )
#         .join(
#             Document,
#             Document.id
#             == DocumentChunk.document_id,
#         )
#         .where(
#             Document.user_id == user_id,
#             Document.status == "ready",
#             DocumentChunk.embedding.is_not(None),
#         )
#         .order_by(distance)
#         .limit(limit)
#     ).all()

#     return [
#         RetrievalResult(
#             chunk_id=chunk.id,
#             document_id=document.id,
#             filename=document.filename,
#             page_number=chunk.page_number,
#             content=chunk.content,
#             distance=float(chunk_distance),
#         )
#         for (
#             chunk,
#             document,
#             chunk_distance,
#         ) in rows
#     ]
import uuid
from dataclasses import dataclass

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.embeddings import embed_text


@dataclass
class RetrievalResult:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    page_number: int
    content: str
    distance: float


def retrieve_chunks(
    db: Session,
    user_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> list[RetrievalResult]:
    query_embedding = embed_text(query)

    distance = (
        DocumentChunk.embedding.cosine_distance(
            query_embedding
        )
    )

    # -------------------------------------------------
    # 1. Semantic/vector candidates
    # -------------------------------------------------

    semantic_rows = db.execute(
        select(
            DocumentChunk,
            Document,
            distance.label("distance"),
        )
        .join(
            Document,
            Document.id
            == DocumentChunk.document_id,
        )
        .where(
            Document.user_id == user_id,
            Document.status == "ready",
            DocumentChunk.embedding.is_not(None),
        )
        .order_by(distance)
        .limit(20)
    ).all()

    # -------------------------------------------------
    # 2. PostgreSQL lexical/full-text candidates
    # -------------------------------------------------

    search_vector = func.to_tsvector(
        "english",
        DocumentChunk.content,
    )

    search_query = func.plainto_tsquery(
        "english",
        query,
    )

    lexical_rank = func.ts_rank_cd(
        search_vector,
        search_query,
    )

    lexical_rows = db.execute(
        select(
            DocumentChunk,
            Document,
            distance.label("distance"),
            lexical_rank.label(
                "lexical_rank"
            ),
        )
        .join(
            Document,
            Document.id
            == DocumentChunk.document_id,
        )
        .where(
            Document.user_id == user_id,
            Document.status == "ready",
            DocumentChunk.embedding.is_not(None),
            search_vector.op("@@")(
                search_query
            ),
        )
        .order_by(
            lexical_rank.desc()
        )
        .limit(20)
    ).all()

    # -------------------------------------------------
    # 3. Reciprocal Rank Fusion
    # -------------------------------------------------

    RRF_K = 60

    candidates: dict[
        uuid.UUID,
        dict,
    ] = {}

    for rank, row in enumerate(
        semantic_rows,
        start=1,
    ):
        chunk, document, chunk_distance = (
            row
        )

        candidates[chunk.id] = {
            "chunk": chunk,
            "document": document,
            "distance": float(
                chunk_distance
            ),
            "score": (
                1 / (RRF_K + rank)
            ),
        }

    for rank, row in enumerate(
        lexical_rows,
        start=1,
    ):
        (
            chunk,
            document,
            chunk_distance,
            _,
        ) = row

        rrf_score = (
            1 / (RRF_K + rank)
        )

        if chunk.id in candidates:
            candidates[
                chunk.id
            ]["score"] += rrf_score
        else:
            candidates[chunk.id] = {
                "chunk": chunk,
                "document": document,
                "distance": float(
                    chunk_distance
                ),
                "score": rrf_score,
            }

    ranked = sorted(
        candidates.values(),
        key=lambda item: item["score"],
        reverse=True,
    )

    return [
        RetrievalResult(
            chunk_id=item["chunk"].id,
            document_id=item[
                "document"
            ].id,
            filename=item[
                "document"
            ].filename,
            page_number=item[
                "chunk"
            ].page_number,
            content=item[
                "chunk"
            ].content,
            distance=item[
                "distance"
            ],
        )
        for item in ranked[:limit]
    ]