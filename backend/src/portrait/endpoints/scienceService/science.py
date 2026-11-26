"""Scientific activity statistics over confirmed eLIBRARY teacher links."""

from collections import Counter, defaultdict
import re
from django.db import connection
from portrait.constants import ScientificActivity


def summarize(rows):
    topics, directions, years = Counter(), Counter(), Counter()
    classifiers = defaultdict(Counter)
    teachers = set()
    with_keywords = with_topics = 0
    for row in rows:
        teachers.update(row["teacher_ids"])
        if row["year"] is not None:
            years[row["year"]] += 1
        terms = {
            str(v).strip().casefold().replace("ё", "е")
            for v in row["keywords"]
            if str(v).strip()
        }
        topics.update(terms)
        with_keywords += bool(terms)
        categories = set()
        for classifier, value in row["topics"].items():
            classifier_terms = set()
            for term in re.split(r"[;\n]+", str(value or "")):
                if term.strip().casefold() not in ("", "нет", "none"):
                    categories.add(term.strip())
                    classifier_terms.add(term.strip())
            classifiers[classifier].update(classifier_terms)
        directions.update(categories)
        with_topics += bool(categories)
    ranked = topics.most_common()
    topic_groups = {
        'all': ranked,
        'ru': [(name, count) for name, count in ranked if re.search('[а-яё]', name)],
        'latin': [(name, count) for name, count in ranked if not re.search('[а-яё]', name) and re.search('[a-z]', name)],
    }
    return {
        'direction_groups': {key: {'count': len(counter), 'items': [{'name': name, 'count': count} for name, count in counter.most_common()]} for key, counter in classifiers.items() if counter},
        'topic_groups': {group: [{'name': name, 'count': count} for name, count in terms[:ScientificActivity.TOPIC_LIMIT]] for group, terms in topic_groups.items()},
        "publications_count": len(rows),
        "teachers_count": len(teachers),
        "directions_count": len(directions),
        "popular_topics": [{"name": k, "count": v} for k, v in topics.most_common(ScientificActivity.TOPIC_LIMIT)],
        "directions": [{"name": k, "count": v} for k, v in directions.most_common()],
        "by_year": [{"year": k, "count": v} for k, v in sorted(years.items())],
        "coverage": {
            "with_keywords": with_keywords,
            "with_topics": with_topics,
            "unknown_year": sum(r["year"] is None for r in rows),
        },
    }


def activity(teacher_id=None, institution_id=None, year=None, page=1):
    filters, params = ["m.status='confirmed'"], []
    for column, value in [
        ("m.teacher_id", teacher_id),
        ("t.institution_id", institution_id),
        ("p.publication_year", year),
    ]:
        if value is not None:
            filters.append(column + "=%s")
            params.append(value)
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT to_regclass('elibrary_publications'),to_regclass('elibrary_teacher_matches')"
        )
        if not all(cursor.fetchone()):
            return None
        cursor.execute(
            """SELECT p.elibrary_id,p.title,p.publication_year,p.keywords,p.topics,p.source_url,
            array_agg(DISTINCT m.teacher_id) FROM elibrary_publications p
            JOIN elibrary_teacher_matches m USING(elibrary_id) JOIN teacher t ON t.id=m.teacher_id
            WHERE """
            + " AND ".join(filters)
            + """ GROUP BY p.elibrary_id
            ORDER BY p.publication_year DESC NULLS LAST,p.elibrary_id DESC""",
            params,
        )
        import json

        rows = []
        for pid, title, pub_year, keywords, topics, url, ids in cursor.fetchall():
            rows.append(
                {
                    "id": pid,
                    "title": title,
                    "year": pub_year,
                    "keywords": (
                        json.loads(keywords)
                        if isinstance(keywords, str)
                        else keywords or []
                    ),
                    "topics": (
                        json.loads(topics) if isinstance(topics, str) else topics or {}
                    ),
                    "url": url,
                    "teacher_ids": ids,
                }
            )
        year_filters = filters[:-1] if year is not None else filters
        year_params = params[:-1] if year is not None else params
        cursor.execute(
            """SELECT DISTINCT p.publication_year FROM elibrary_publications p
            JOIN elibrary_teacher_matches m USING(elibrary_id) JOIN teacher t ON t.id=m.teacher_id
            WHERE p.publication_year IS NOT NULL AND """
            + " AND ".join(year_filters)
            + " ORDER BY p.publication_year DESC",
            year_params,
        )
        available_years = [r[0] for r in cursor.fetchall()]
    result = summarize(rows)
    result.update(
        page=page,
        page_size=ScientificActivity.PAGE_SIZE,
        publications=rows[(page - 1) * ScientificActivity.PAGE_SIZE : page * ScientificActivity.PAGE_SIZE],
        match_status="confirmed",
        available_years=available_years,
    )
    return result
