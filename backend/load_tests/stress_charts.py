"""Финальные графики стресс-теста (v6) из stress_stats_history.csv.

Верх: RPS (зелёный) и ошибки/с (красный).
Низ: пользователи (синий, левая ось) и время ответа — медиана/p95 (правая ось).
"""

import csv

import matplotlib.pyplot as plt

path = "load_tests/results/stress_stats_history.csv"

t, users, rps, fail, p50, p95 = [], [], [], [], [], []
with open(path, newline="") as f:
    for row in csv.DictReader(f):
        if row["Name"] != "Aggregated":
            continue
        t.append(int(row["Timestamp"]))
        users.append(int(row["User Count"]))
        rps.append(float(row["Requests/s"]))
        fail.append(float(row["Failures/s"]))
        try:
            p50.append(float(row["50%"]) / 1000)
            p95.append(float(row["95%"]) / 1000)
        except ValueError:
            p50.append(None)
            p95.append(None)

t0 = t[0]
t = [x - t0 for x in t]
pairs50 = [(ti, yi) for ti, yi in zip(t, p50) if yi is not None]
pairs95 = [(ti, yi) for ti, yi in zip(t, p95) if yi is not None]

fig = plt.figure(figsize=(14, 8))
gs = fig.add_gridspec(2, 1, height_ratios=[1.1, 1])

steps = [150, 300, 450, 600, 750]

# --- RPS + ошибки ---
ax = fig.add_subplot(gs[0])
ax.plot(t, rps, "g", label="Запросов/с", linewidth=1.6)
ax.plot(t, fail, "r", label="Ошибок/с", linewidth=1.6)
for step in steps:
    ax.axvline(step, color="gray", linestyle=":", alpha=0.5)
ax.set_title("Пропускная способность и ошибки \n(вертикальные линии: 10 → 25 → 50 → 100 → 200 → 400 пользователей)")
ax.set_xlabel("секунда теста")
ax.set_ylabel("запросов / ошибок в секунду")
ax.grid(alpha=0.3)
ax.legend(fontsize=10, loc="upper left")

# --- пользователи + время ответа на одном графике ---
ax = fig.add_subplot(gs[1])
ax.plot(t, users, "b", label="Пользователи", linewidth=1.6)
ax.set_ylabel("пользователей", color="b")
ax.tick_params(axis="y", labelcolor="b")
ax.set_xlabel("секунда теста")
for step in steps:
    ax.axvline(step, color="gray", linestyle=":", alpha=0.5)

ax2 = ax.twinx()
ax2.plot([a for a, _ in pairs95], [b for _, b in pairs95], "r", label="p95 ответа, с", linewidth=1.6)
ax2.set_ylabel("секунды", color="k")
lines1, labels1 = ax.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax.legend(lines1 + lines2, labels1 + labels2, fontsize=10, loc="upper left")
ax.grid(alpha=0.3)

fig.suptitle(
    "Стресс-тест с pgbouncer + Redis",
    fontsize=13,
)
fig.tight_layout()
out = "load_tests/results/stress_charts.png"
fig.savefig(out, dpi=130)
print("saved:", out)
