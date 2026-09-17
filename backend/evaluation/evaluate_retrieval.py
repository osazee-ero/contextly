import json

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User
from app.services.retrieval import retrieve_chunks


EVAL_USER_EMAIL = "eroewaen@gmail.com"
DATASET_PATH = "evaluation/dataset.json"
TOP_K = 5


def reciprocal_rank(
    retrieved,
    expected_filename: str,
    expected_page: int,
) -> float:
    for rank, result in enumerate(
        retrieved,
        start=1,
    ):
        if (
            result.filename == expected_filename
            and result.page_number == expected_page
        ):
            return 1.0 / rank

    return 0.0


def is_hit_at_k(
    retrieved,
    expected_filename: str,
    expected_page: int,
    k: int,
) -> bool:
    return any(
        result.filename == expected_filename
        and result.page_number == expected_page
        for result in retrieved[:k]
    )


def main():
    with open(
        DATASET_PATH,
        "r",
        encoding="utf-8",
    ) as file:
        dataset = json.load(file)

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

        recall_1_hits = 0
        recall_3_hits = 0
        recall_5_hits = 0

        reciprocal_rank_total = 0.0

        print()
        print(
            f"Evaluating {total} questions"
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
                limit=TOP_K,
            )

            hit_1 = is_hit_at_k(
                retrieved,
                expected_filename,
                expected_page,
                1,
            )

            hit_3 = is_hit_at_k(
                retrieved,
                expected_filename,
                expected_page,
                3,
            )

            hit_5 = is_hit_at_k(
                retrieved,
                expected_filename,
                expected_page,
                5,
            )

            rr = reciprocal_rank(
                retrieved,
                expected_filename,
                expected_page,
            )

            if hit_1:
                recall_1_hits += 1

            if hit_3:
                recall_3_hits += 1

            if hit_5:
                recall_5_hits += 1

            reciprocal_rank_total += rr

            status = (
                "PASS"
                if hit_5
                else "FAIL"
            )

            print()
            print(
                f"[{index}] {status}"
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
                "Retrieved:"
            )

            for rank, result in enumerate(
                retrieved,
                start=1,
            ):
                marker = ""

                if (
                    result.filename
                    == expected_filename
                    and
                    result.page_number
                    == expected_page
                ):
                    marker = " <-- MATCH"

                print(
                    f"  {rank}. "
                    f"{result.filename} "
                    f"(page {result.page_number}) "
                    f"distance="
                    f"{result.distance:.4f}"
                    f"{marker}"
                )

            print(
                f"RR: {rr:.4f}"
            )

        recall_at_1 = (
            recall_1_hits
            / total
            * 100
        )

        recall_at_3 = (
            recall_3_hits
            / total
            * 100
        )

        recall_at_5 = (
            recall_5_hits
            / total
            * 100
        )

        mrr = (
            reciprocal_rank_total
            / total
        )

        print()
        print("=" * 70)

        print(
            f"Recall@1: "
            f"{recall_at_1:.2f}% "
            f"({recall_1_hits}/{total})"
        )

        print(
            f"Recall@3: "
            f"{recall_at_3:.2f}% "
            f"({recall_3_hits}/{total})"
        )

        print(
            f"Recall@5: "
            f"{recall_at_5:.2f}% "
            f"({recall_5_hits}/{total})"
        )

        print(
            f"MRR: {mrr:.4f}"
        )

        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    main()