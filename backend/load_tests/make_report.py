"""Сводный график исследования предела нагрузки: v3 -> v4 -> v6.

v6 пересчитывается из stress_stats_history.csv; v3/v4 — из таблиц,
зафиксированных в отчётах прогонов (их CSV были перезаписаны следующими прогонами).
"""

import csv

import matplotlib.pyplot as plt

# users, fail%, p95 (с), p50 (с) — медианы устоявшейся части каждой ступени
RUNS = {
    "v3: локально, без CONN_MAX_AGE": {
        "users": [10, 25, 50, 100, 200, 400],
        "fail": [4.3, 3.6, 0.0, 87.8, 93.9, 92.1],
        "p95": [61, 37, 27, 22, 19, 39],
    },
    "v4: локально, CONN_MAX_AGE=60": {
        "users": [10, 25, 50, 100, 200, 400],
        "fail": [3.0, 0.0, 0.0, 89.1, 94.1, 94.4],
        "p95": [39, 36, 14, 6.9, 16, 27],
    },
}


def load_v6(path):
    rows = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if row["Name"] != "Aggregated":
                continue
            try:
                rows.append(
                    (
                        int(row["User Count"]),
                        float(row["Requests/s"]),
                        float(row["Failures/s"]),
                        float(row["50%"]) / 1000,
                        float(row["95%"]) / 1000,
                    )
                )
            except ValueError:
                continue
    targets = [10, 25, 50, 100, 200, 400]
    by_step = {t: [] for t in targets}
    for r in rows:
        nearest = min(targets, key=lambda t: abs(t - r[0]))
        by_step[nearest].append(r)
    users, fail, p95 = [], [], []
    for t in targets:
        rs = by_step[t][len(by_step[t]) // 2:]  # устоявшаяся часть ступени
        if not rs:
            continue
        rps = sum(r[1] for r in rs) / len(rs)
        fl = sum(r[2] for r in rs) / len(rs)
        users.append(t)
        fail.append(round(100 * fl / rps, 1) if rps else 0.0)
        p95.append(round(sorted(r[4] for r in rs)[len(rs) // 2], 1))
    return {"users": users, "fail": fail, "p95": p95}


RUNS["v6: стек: pgbouncer + Redis, фиксы"] = load_v6(
    "load_tests/results/stress_stats_history.csv"
)

fig, axes = plt.subplots(1, 2, figsize=(13, 5))
styles = ["r--o", "y--s", "g-^"]

for (label, data), style in zip(RUNS.items(), styles):
    axes[0].plot(data["users"], data["fail"], style, label=label, linewidth=2)
    axes[1].plot(data["users"], data["p95"], style, label=label, linewidth=2)

axes[0].set_title("Доля ошибок по ступеням нагрузки")
axes[0].set_xlabel("пользователей")
axes[0].set_ylabel("ошибки, %")
axes[0].grid(alpha=0.3)
axes[0].legend(fontsize=8)

axes[1].set_title("p95 по ступеням нагрузки")
axes[1].set_xlabel("пользователей")
axes[1].set_ylabel("p95, сек")
axes[1].grid(alpha=0.3)
axes[1].legend(fontsize=8)

fig.suptitle("Исследование предела нагрузки: 10 → 400 пользователей (150 с на ступень)")
fig.tight_layout()
out = "load_tests/results/load_limit_study.png"
fig.savefig(out, dpi=130)
print("saved:", out)
