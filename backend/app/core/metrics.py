from collections import deque
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class MetricsStore:
    http_requests: int = 0

    rag_completed: int = 0
    rag_failed: int = 0

    ingestion_completed: int = 0
    ingestion_failed: int = 0

    request_durations_ms: deque[float] = field(
        default_factory=lambda: deque(maxlen=1000)
    )

    rag_durations_ms: deque[float] = field(
        default_factory=lambda: deque(maxlen=1000)
    )

    ingestion_durations_ms: deque[float] = field(
        default_factory=lambda: deque(maxlen=1000)
    )

    lock: Lock = field(
        default_factory=Lock
    )

    def record_http_request(
        self,
        duration_ms: float,
    ) -> None:
        with self.lock:
            self.http_requests += 1

            self.request_durations_ms.append(
                duration_ms
            )

    def record_rag_completed(
        self,
        duration_ms: float,
    ) -> None:
        with self.lock:
            self.rag_completed += 1

            self.rag_durations_ms.append(
                duration_ms
            )

    def record_rag_failed(
        self,
    ) -> None:
        with self.lock:
            self.rag_failed += 1

    def record_ingestion_completed(
        self,
        duration_ms: float,
    ) -> None:
        with self.lock:
            self.ingestion_completed += 1

            self.ingestion_durations_ms.append(
                duration_ms
            )

    def record_ingestion_failed(
        self,
    ) -> None:
        with self.lock:
            self.ingestion_failed += 1

    @staticmethod
    def average(
        values: list[float] | deque[float],
    ) -> float:
        if not values:
            return 0.0

        return round(
            sum(values) / len(values),
            2,
        )

    def snapshot(
        self,
    ) -> dict:
        with self.lock:
            return {
                "http_requests": (
                    self.http_requests
                ),
                "rag": {
                    "completed": (
                        self.rag_completed
                    ),
                    "failed": (
                        self.rag_failed
                    ),
                    "average_duration_ms": (
                        self.average(
                            self.rag_durations_ms
                        )
                    ),
                },
                "ingestion": {
                    "completed": (
                        self.ingestion_completed
                    ),
                    "failed": (
                        self.ingestion_failed
                    ),
                    "average_duration_ms": (
                        self.average(
                            self.ingestion_durations_ms
                        )
                    ),
                },
                "http": {
                    "average_duration_ms": (
                        self.average(
                            self.request_durations_ms
                        )
                    ),
                },
            }


metrics = MetricsStore()