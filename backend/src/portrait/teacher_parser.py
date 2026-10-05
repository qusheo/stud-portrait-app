from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

UTMN_BASE_URL = "https://www.utmn.ru"
LMS_BASE_URL = "https://lms.utmn.ru"
TEXT_PROXY_URL = "https://r.jina.ai/"

DEFAULT_TEACHER_SOURCE_URLS = [
    "https://www.utmn.ru/scs/about/struktura-instituta/kafedra-programmnogo-obespecheniya/sostav-kafedry.php",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

NAME_RE = re.compile(
    r"^[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+){2,3}$"
)
EMAIL_RE = re.compile(r"[\w.\-+]+@utmn\.ru", re.IGNORECASE)
DEGREE_RE = re.compile(
    r"(к\.\s*[а-яё.-]+\s*н\.|д\.\s*[а-яё.-]+\s*н\.|канд\.|д-р|доктор|аспирант)",
    re.IGNORECASE,
)
COURSE_TITLE_RE = re.compile(r"^\s*#{2,4}\s+(.+?)\s*$", re.MULTILINE)
TEACHER_LINE_RE = re.compile(r"Преподаватель(?:-эксперт)?\s*:\s*([^\n\r]+)", re.IGNORECASE)
MARKDOWN_PROFILE_RE = re.compile(
    r"^(?P<name>[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+){2})\s+(?P<position>.+)$"
)

STOPWORDS = {
    "кафедра", "кафедры", "институт", "школа", "университет", "тюмгу",
    "доцент", "профессор", "старший", "преподаватель", "ассистент",
    "заведующий", "заместитель", "директор", "руководитель", "кандидат",
    "доктор", "наук", "аспирант", "инженер", "ооо", "ао", "центр",
}


@dataclass
class TeacherProfile:
    full_name: str
    position: str = ""
    degree: str = ""
    department: str = ""
    email: str = ""
    profile_url: str = ""
    source_url: str = ""
    interests: list[str] = field(default_factory=list)
    qualification_courses: list[dict] = field(default_factory=list)
    publications: list[dict] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    modeus_disciplines: list[dict] = field(default_factory=list)
    raw_profile: dict = field(default_factory=dict)


def parse_teachers(
    source_urls: Iterable[str] | None = None,
    include_lms: bool = True,
    progress_callback=None,
) -> list[TeacherProfile]:
    urls = list(source_urls or DEFAULT_TEACHER_SOURCE_URLS)
    profiles_by_name: dict[str, TeacherProfile] = {}

    total = len(urls)
    for index, url in enumerate(urls, start=1):
        _progress(progress_callback, "Загрузка страниц преподавателей", index, total)
        for profile in _parse_staff_page(url):
            existing = profiles_by_name.get(profile.full_name)
            if existing:
                _merge_profile(existing, profile)
            else:
                profiles_by_name[profile.full_name] = profile

    profiles = list(profiles_by_name.values())
    if include_lms:
        total = len(profiles)
        for index, profile in enumerate(profiles, start=1):
            _progress(progress_callback, "Поиск курсов повышения квалификации", index, total)
            courses = _find_lms_courses(profile.full_name)
            profile.qualification_courses = courses
            profile.interests = _unique(profile.interests + _interests_from_courses(courses))

    for profile in profiles:
        profile.interests = _unique(profile.interests or _extract_interests(profile.position))

    return profiles


def _parse_staff_page(url: str) -> list[TeacherProfile]:
    try:
        html = _fetch_text(url, timeout=10)
    except requests.RequestException as exc:
        logger.warning("Прямой запрос к %s не выполнен: %s", url, exc)
        source_url = url.replace("https://", "http://", 1)
        markdown = _fetch_text(
            f"{TEXT_PROXY_URL}{source_url}",
            timeout=60,
            headers={"User-Agent": "curl/8.0", "Accept": "text/plain"},
        )
        return _parse_staff_markdown(markdown, url)

    soup = BeautifulSoup(html, "html.parser")
    text_lines = _content_lines(soup)
    department = _detect_department(soup, text_lines)
    profiles: list[TeacherProfile] = []

    i = 0
    while i < len(text_lines):
        line = text_lines[i]
        if not _looks_like_name(line):
            i += 1
            continue

        details: list[str] = []
        j = i + 1
        while j < len(text_lines) and not _looks_like_name(text_lines[j]):
            candidate = text_lines[j].strip()
            if candidate and not _is_navigation_line(candidate):
                details.append(candidate)
            j += 1

        detail_text = " ".join(details[:4]).strip()
        email_match = EMAIL_RE.search(" ".join(details))
        degree_match = DEGREE_RE.search(detail_text)
        profile = TeacherProfile(
            full_name=line,
            position=detail_text,
            degree=degree_match.group(0) if degree_match else "",
            department=department,
            email=email_match.group(0) if email_match else "",
            source_url=url,
            interests=_extract_interests(detail_text),
            raw_profile={"page_lines": details[:8]},
        )
        profiles.append(profile)
        i = j

    return profiles


def _parse_staff_markdown(markdown: str, source_url: str) -> list[TeacherProfile]:
    content = markdown
    section_match = re.search(
        r"# Состав кафедры\s+программного обеспечения(?P<body>.*?)(?:\nБыстрые ссылки|\Z)",
        markdown,
        re.DOTALL | re.IGNORECASE,
    )
    if section_match:
        content = section_match.group("body")

    profiles: list[TeacherProfile] = []
    for raw_line in content.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" *")
        match = MARKDOWN_PROFILE_RE.match(line)
        if not match:
            continue

        name = match.group("name").strip()
        position = match.group("position").strip()
        degree_match = DEGREE_RE.search(position)
        profiles.append(TeacherProfile(
            full_name=name,
            position=position,
            degree=degree_match.group(0) if degree_match else "",
            department="Кафедра программного обеспечения",
            source_url=source_url,
            interests=_extract_interests(position),
            raw_profile={"page_lines": [position], "fetched_via": TEXT_PROXY_URL},
        ))

    return profiles


def _find_lms_courses(full_name: str, max_pages: int = 2) -> list[dict]:
    courses: list[dict] = []
    name_parts = set(full_name.lower().split())

    for page in range(max_pages):
        url = f"{LMS_BASE_URL}/course/search.php?search={quote_plus(full_name)}&page={page}"
        try:
            html = _fetch_text(url, timeout=20)
        except requests.RequestException as exc:
            logger.info("Не удалось получить курсы LMS для %s: %s", full_name, exc)
            continue

        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text("\n", strip=True)
        if "Повышение квалификации" not in text and not name_parts.intersection(text.lower().split()):
            continue

        titles = _extract_lms_course_titles(soup, text)
        teacher_lines = TEACHER_LINE_RE.findall(text)
        if titles:
            for title in titles:
                block_mentions_teacher = any(part in text.lower() for part in name_parts)
                if block_mentions_teacher and _is_development_course(text, title):
                    courses.append({
                        "title": title,
                        "category": "Повышение квалификации",
                        "source_url": url,
                    })
        elif any(full_name.lower() in line.lower() for line in teacher_lines):
            courses.append({
                "title": "Курс повышения квалификации LMS ТюмГУ",
                "category": "Повышение квалификации",
                "source_url": url,
            })

    return _unique_dicts(courses, "title")


def _fetch_text(url: str, timeout: int = 30, headers: dict | None = None) -> str:
    response = requests.get(url, headers=headers or HEADERS, timeout=timeout)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    return response.text


def _extract_lms_course_titles(soup: BeautifulSoup, text: str) -> list[str]:
    titles: list[str] = []
    for link in soup.select('a[href*="course/info.php"], a[href*="course/view.php"]'):
        title = link.get_text(" ", strip=True)
        if title:
            titles.append(title)

    if not titles:
        titles = [m.group(1).strip() for m in COURSE_TITLE_RE.finditer(text)]

    return _unique(titles)


def _content_lines(soup: BeautifulSoup) -> list[str]:
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return [line for line in lines if line]


def _detect_department(soup: BeautifulSoup, lines: list[str]) -> str:
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    for line in lines:
        if "кафедр" in line.lower() or "департамент" in line.lower():
            return line[:1024]
    return title[:1024]


def _looks_like_name(line: str) -> bool:
    if len(line) > 96 or any(ch.isdigit() for ch in line):
        return False
    return bool(NAME_RE.match(line))


def _is_navigation_line(line: str) -> bool:
    low = line.lower()
    return low in {"главная", "контакты", "новости", "студентам", "наука"} or "быстрые ссылки" in low


def _is_development_course(text: str, title: str) -> bool:
    combined = f"{title}\n{text}".lower()
    return "повышение квалификации" in combined or "профессиональной переподготов" in combined


def _extract_interests(text: str) -> list[str]:
    words = re.findall(r"[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z-]{3,}", text.lower())
    keywords: list[str] = []
    for word in words:
        normalized = word.strip("-")
        if normalized not in STOPWORDS and normalized not in keywords:
            keywords.append(normalized)
    return keywords[:12]


def _interests_from_courses(courses: list[dict]) -> list[str]:
    interests: list[str] = []
    for course in courses:
        interests.extend(_extract_interests(course.get("title", "")))
    return interests


def _merge_profile(target: TeacherProfile, source: TeacherProfile) -> None:
    for field_name in ("position", "degree", "department", "email", "profile_url", "source_url"):
        if not getattr(target, field_name) and getattr(source, field_name):
            setattr(target, field_name, getattr(source, field_name))
    target.interests = _unique(target.interests + source.interests)
    target.raw_profile.setdefault("merged_sources", []).append(source.raw_profile)


def _unique(items: Iterable[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        clean = str(item).strip()
        if clean and clean not in result:
            result.append(clean)
    return result


def _unique_dicts(items: Iterable[dict], key: str) -> list[dict]:
    result: list[dict] = []
    seen = set()
    for item in items:
        value = item.get(key)
        if value and value not in seen:
            seen.add(value)
            result.append(item)
    return result


def _progress(callback, step: str, current: int = 0, total: int = 0) -> None:
    logger.info("[teacher-parser] %s (%d/%d)", step, current, total)
    if callback:
        callback(step, current, total)
