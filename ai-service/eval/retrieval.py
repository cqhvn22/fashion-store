"""Small, reproducible retrieval smoke evaluation against an indexed database."""

import json
import statistics
import time
from pathlib import Path

from app.services.products import retrieve_products


def main() -> None:
    cases = json.loads(Path(__file__).with_name("retrieval_cases.json").read_text(encoding="utf-8"))
    hits = 0
    exact_hits = 0
    exact_total = 0
    durations = []
    for case in cases:
        started = time.perf_counter()
        results = retrieve_products(case["question"], limit=5)
        durations.append((time.perf_counter() - started) * 1000)
        if case.get("expect_empty"):
            rank = 1 if not results else None
        elif "expected_slug" in case:
            exact_total += 1
            rank = next((index for index, row in enumerate(results, 1)
                         if row["slug"] == case["expected_slug"]), None)
            exact_hits += rank is not None
        else:
            rank = next((index for index, row in enumerate(results, 1)
                         if all(term in row["name"].casefold() for term in case["expected_terms"])
                         and row["price"] <= case.get("max_price", float("inf"))), None)
        hits += rank is not None
        print(json.dumps({"question": case["question"], "rank": rank,
                          "top_slugs": [row["slug"] for row in results]}, ensure_ascii=False))
    report = {"cases": len(cases), "pass_rate": hits / len(cases),
              "exact_recall_at_5": exact_hits / exact_total,
              "latency_p50_ms": round(statistics.median(durations), 1),
              "latency_max_ms": round(max(durations), 1)}
    print(json.dumps(report, ensure_ascii=False))
    if hits != len(cases):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
