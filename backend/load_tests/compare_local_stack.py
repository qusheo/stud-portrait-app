"""Сравнение «локально vs полный стек», профиль 60 пользователей / 3 минуты, без boxplot.

Верх — общие временны́е ряды (Aggregated): пользователи, throughput, ошибки, p95.
Низ — отдельно лёгкие запросы и аналитика: среднее время по endpoint'у
и число ошибок, локально vs стек.
"""

import csv

import matplotlib.pyplot as plt

RUNS = {
    "cmp2-local": ("Локально uvicorn 1 воркер", "r"),
    "cmp2-stack": ("docker, pgbouncer + Redis, 3 воркера", "g"),
}

SETUP_NAMES = {
    "setup/csrf", "setup/csrf-after-login", "setup/login",
    "setup/get-institutions", "setup/students-list",
}

# аналитика 
ANALYTICS_MARKERS = (
    "matching-students",
    "by-requirements",
    "filter-options-counts",
    "centers-by-region",
    "discipline-heatmap",
)


def is_analytics(name):
    return any(m in name for m in ANALYTICS_MARKERS)


def load_history(path):
    t, users, rps, fail, p95 = [], [], [], [], []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if row["Name"] != "Aggregated":
                continue
            t.append(int(row["Timestamp"]))
            users.append(int(row["User Count"]))
            rps.append(float(row["Requests/s"]))
            fail.append(float(row["Failures/s"]))
            try:
                p95.append(float(row["95%"]) / 1000)
            except ValueError:
                p95.append(None)
    t0 = t[0]
    return [x - t0 for x in t], users, rps, fail, p95


def load_stats(path):
    out = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if not row["Name"] or row["Name"] == "Aggregated":
                continue
            try:
                out[row["Name"]] = {
                    "reqs": int(float(row["Request Count"])),
                    "fails": int(float(row["Failure Count"])),
                    "avg": float(row["Average Response Time"]) / 1000,
                }
            except ValueError:
                continue
    return out


hist = {p: load_history(f"results/{p}_stats_history.csv") for p in RUNS}
stats = {p: load_stats(f"results/{p}_stats.csv") for p in RUNS}

fig = plt.figure(figsize=(14, 14))
gs = fig.add_gridspec(4, 2, height_ratios=[1, 1, 1.1, 1.1])

panels = [
    (0, 0, "Пользователи", "пользователей", "users"),
    (0, 1, "Пропускная способность", "запросов/с", "rps"),
    (1, 0, "Ошибки, всего", "ошибок/с", "fail"),
    (1, 1, "p95, всего", "сек", "p95"),
]
for row, col, title, ylabel, key in panels:
    ax = fig.add_subplot(gs[row, col])
    for p, (label, color) in RUNS.items():
        t, users, rps, fail, p95 = hist[p]
        y = {"users": users, "rps": rps, "fail": fail, "p95": p95}[key]
        if key == "p95":
            pairs = [(ti, yi) for ti, yi in zip(t, y) if yi is not None]
            t, y = [a for a, _ in pairs], [b for _, b in pairs]
        ax.plot(t, y, color, label=label, linewidth=1.5)
    ax.set_title(title)
    ax.set_xlabel("секунда теста")
    ax.set_ylabel(ylabel)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=9)


def endpoint_panel(row, analytics, title):
    ax = fig.add_subplot(gs[row, :])
    names = sorted(
        {n for p in RUNS for n in stats[p]
         if n not in SETUP_NAMES and is_analytics(n) == analytics},
        key=lambda n: -max(stats[p].get(n, {}).get("avg", 0) for p in RUNS),
    )
    x = list(range(len(names)))
    w = 0.38
    for i, (p, (label, color)) in enumerate(RUNS.items()):
        avgs = [stats[p].get(n, {}).get("avg", 0) for n in names]
        fails = [stats[p].get(n, {}).get("fails", 0) for n in names]
        bars = ax.bar(
            [xi + (i - 0.5) * w for xi in x], avgs, w, color=color,
        )
        for bar, fl in zip(bars, fails):
            if fl:
                ax.text(
                    bar.get_x() + bar.get_width() / 2, bar.get_height(),
                    f"{fl} ош.", ha="center", va="bottom", fontsize=8,
                )
    ax.set_yscale("log")
    ax.set_xticks(x)
    ax.set_xticklabels([n.split("/", 1)[-1] for n in names], rotation=45, ha="right", fontsize=9)
    ax.set_ylabel("среднее время, сек")
    ax.grid(alpha=0.3, axis="y")
    ax.legend(fontsize=9)


endpoint_panel(2, False, "Легкие запросы")
endpoint_panel(3, True, "Аналитика")

fig.suptitle(
    "Профиль нагрузки: 60 пользователей, разгон 2/с, 3 минуты — локально vs полный стек",
    fontsize=13,
)
fig.tight_layout()
out = "results/local_vs_stack_60users.png"
fig.savefig(out, dpi=120)
print("saved:", out)

for p, (label, _) in RUNS.items():
    line = []
    for analytics in (False, True):
        group = [v for n, v in stats[p].items() if is_analytics(n) == analytics and n not in SETUP_NAMES]
        req = sum(v["reqs"] for v in group)
        fl = sum(v["fails"] for v in group)
        avg = sum(v["avg"] * v["reqs"] for v in group) / req if req else 0
        name = "аналитика" if analytics else "легкие"
        line.append(f"{name}: {req} зап., {fl} ош. ({100 * fl / req if req else 0:.0f}%), ср. {avg:.1f}с")
    print(" | ".join(line))
