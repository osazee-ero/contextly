import json

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User
from app.services.answer_generation import generate_answer
from app.services.retrieval import retrieve_chunks


EVAL_USER_EMAIL = "eroewaen@gmail.com"
DATASET_PATH = "evaluation/dataset.json"
MAX_QUESTIONS = None


def main():
    with open(
        DATASET_PATH,
        "r",
        encoding="utf-8",
    ) as file:
        dataset = json.load(file)

    if MAX_QUESTIONS is not None:
        dataset = dataset[:MAX_QUESTIONS]

    db = SessionLocal()

    try:
        user = db.execute(
            select(User).where(
                User.email == EVAL_USER_EMAIL
            )
        ).scalar_one_or_none()

        if user is None:
            raise RuntimeError(
                f"User not found: {EVAL_USER_EMAIL}"
            )

        total = len(dataset)

        citation_passes = 0
        answer_passes = 0

        print()
        print(
            f"Evaluating answers for "
            f"{total} questions"
        )
        print(
            f"User: {EVAL_USER_EMAIL}"
        )
        print("-" * 70)

        for index, item in enumerate(
            dataset,
            start=1,
        ):
            question = item["question"]

            expected_filename = (
                item["expected_filename"]
            )

            expected_page = (
                item["expected_page"]
            )

            retrieved = retrieve_chunks(
                db=db,
                user_id=user.id,
                query=question,
            )

            generated = generate_answer(
                question=question,
                results=retrieved,
            )

            citation_match = any(
                source.source.filename
                == expected_filename
                and
                source.source.page_number
                == expected_page
                for source in generated.sources
            )

            answer_generated = (
                bool(
                    generated.answer.strip()
                )
                and not generated.insufficient_context
            )

            if citation_match:
                citation_passes += 1

            if answer_generated:
                answer_passes += 1

            print()
            print(
                f"[{index}] "
                f"{'PASS' if citation_match else 'FAIL'}"
            )

            print(
                f"Question: {question}"
            )

            print(
                "Expected: "
                f"{expected_filename} "
                f"page {expected_page}"
            )

            print(
                "Answer:"
            )

            print(
                generated.answer
            )

            print(
                "Citations:"
            )

            if generated.sources:
                for cited in generated.sources:
                    print(
                        "  "
                        f"{cited.citation_number}. "
                        f"{cited.source.filename} "
                        f"(page "
                        f"{cited.source.page_number})"
                    )
            else:
                print(
                    "  No citations returned."
                )

            print(
                "Insufficient context: "
                f"{generated.insufficient_context}"
            )

        citation_accuracy = (
            citation_passes
            / total
            * 100
        )

        answer_rate = (
            answer_passes
            / total
            * 100
        )

        print()
        print("=" * 70)

        print(
            "Citation accuracy: "
            f"{citation_accuracy:.2f}%"
        )

        print(
            f"Citation passes: "
            f"{citation_passes}/{total}"
        )

        print(
            "Answer generation rate: "
            f"{answer_rate:.2f}%"
        )

        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    main()