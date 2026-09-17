import re
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import settings
from app.services.retrieval import RetrievalResult


client = OpenAI(
    api_key=settings.openai_api_key,
)


@dataclass
class CitedSource:
    citation_number: int
    source: RetrievalResult


@dataclass
class GeneratedAnswer:
    answer: str
    insufficient_context: bool
    sources: list[CitedSource]


INSUFFICIENT_CONTEXT_MESSAGE = (
    "I couldn't find enough information "
    "in your documents to answer this "
    "question reliably."
)


def build_context(
    results: list[RetrievalResult],
) -> str:
    sections: list[str] = []

    for index, result in enumerate(
        results,
        start=1,
    ):
        sections.append(
            (
                f"[SOURCE {index}]\n"
                f"Filename: {result.filename}\n"
                f"Page: {result.page_number}\n"
                f"Content:\n{result.content}"
            )
        )

    return "\n\n".join(sections)


def extract_citation_numbers(
    answer: str,
) -> list[int]:
    """
    Extract citations such as [1], [2], [3]
    from the generated answer.

    Duplicates are removed while preserving
    the order in which citations first appear.
    """

    matches = re.findall(
        r"\[(\d+)\]",
        answer,
    )

    citation_numbers: list[int] = []

    for match in matches:
        number = int(match)

        if number not in citation_numbers:
            citation_numbers.append(number)

    return citation_numbers


def get_cited_sources(
    answer: str,
    available_sources: list[RetrievalResult],
) -> list[CitedSource]:
    citation_numbers = (
        extract_citation_numbers(
            answer
        )
    )

    cited_sources: list[CitedSource] = []

    for citation_number in citation_numbers:
        source_index = (
            citation_number - 1
        )

        if (
            0 <= source_index
            < len(available_sources)
        ):
            cited_sources.append(
                CitedSource(
                    citation_number=(
                        citation_number
                    ),
                    source=(
                        available_sources[
                            source_index
                        ]
                    ),
                )
            )

    return cited_sources


def generate_answer(
    question: str,
    results: list[RetrievalResult],
) -> GeneratedAnswer:

    # The retrieval service already ranks and
    # selects the best evidence using hybrid
    # retrieval + RRF.
    #
    # Do not apply the old cosine-distance
    # threshold here because lexical retrieval
    # may identify useful evidence even when
    # cosine distance is relatively high.

    if not results:
        return GeneratedAnswer(
            answer=(
                INSUFFICIENT_CONTEXT_MESSAGE
            ),
            insufficient_context=True,
            sources=[],
        )

    context = build_context(
        results
    )

    instructions = """
You are Contextly, a document question-answering assistant.

Answer the user's question using only the supplied document sources.

Rules:

- Use only information contained in the supplied sources.
- Do not use outside knowledge.
- Do not invent facts.
- Consider all supplied sources together before deciding whether the question can be answered.
- Information needed for an answer may be distributed across multiple sources.
- If the sources contain enough information to answer at least part of the question, provide the supported answer rather than refusing completely.
- If only part of the requested information is supported, clearly state what can be determined from the sources.
- Every factual claim must be supported by a citation.
- Cite sources using [1], [2], [3], etc.
- Only cite source numbers that appear in the supplied context.
- Do not invent source numbers.
- Do not invent filenames or page numbers.
- When multiple sources contribute to an answer, combine the information and cite the appropriate sources.
- Do not reject an answer merely because information is spread across different sources.
- Only say that there is insufficient information when the supplied sources genuinely do not contain enough evidence to answer the question.
- If there is insufficient information, respond exactly with:

"I couldn't find enough information in your documents to answer this question reliably."

- Prefer concise, direct answers.
"""

    input_text = f"""
DOCUMENT SOURCES

{context}

USER QUESTION

{question}
"""

    response = client.responses.create(
        model=settings.openai_chat_model,
        instructions=instructions,
        input=input_text,
    )

    answer = (
        response.output_text.strip()
    )

    if (
        not answer
        or
        INSUFFICIENT_CONTEXT_MESSAGE.lower()
        in answer.lower()
    ):
        return GeneratedAnswer(
            answer=(
                INSUFFICIENT_CONTEXT_MESSAGE
            ),
            insufficient_context=True,
            sources=[],
        )

    cited_sources = (
        get_cited_sources(
            answer=answer,
            available_sources=results,
        )
    )

    # Keep this validation.
    # If the model gives an answer without
    # a valid citation, do not expose it as
    # a grounded Contextly answer.
    if not cited_sources:
        return GeneratedAnswer(
            answer=(
                "I couldn't verify this answer "
                "against your document sources "
                "reliably. Try rephrasing your "
                "question."
            ),
            insufficient_context=True,
            sources=[],
        )

    return GeneratedAnswer(
        answer=answer,
        insufficient_context=False,
        sources=cited_sources,
    )