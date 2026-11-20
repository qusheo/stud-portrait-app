import re
import requests
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
import pandas as pd
import time

headers = {
    "User-Agent": "Mozilla/5.0"
}

def get_latest_year():
    url = "https://monitoring.miccedu.ru/?m=vpo"
    response = requests.get(
        url, 
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    text = soup.get_text(" ", strip=True)
    years = re.findall(
        r"Мониторинг\s+(20\d{2})",
        text
    )

    if not years:
        raise ValueError("Не найден год мониторинга")

    return max(map(int, years))

years = range(2022, get_latest_year() + 1)

def get_universities(search_text, year):
    url = "https://monitoring.miccedu.ru/iam/set_SearchVuzList.php"

    params = {
        "m": "vpo",
        "year": year,
        "type": 1,
        "search_text": search_text
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.encoding = "utf-8"
    except requests.exceptions.RequestException as e:
        print(f"Ошибка поиска '{search_text}': {e}")
        return {}

    soup = BeautifulSoup(response.text, "lxml")

    universities = {}

    for p in soup.find_all("p"):
        university_id = p.get("id")
        university_name = p.get_text(" ", strip=True)

        if university_id is not None:
            universities[university_id] = university_name

    return universities


def parse_university(university_id, university_name, year):
    url = f"https://monitoring.miccedu.ru/iam/{year}/_vpo/inst.php?id={university_id}"

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.encoding = "utf-8"
    except requests.exceptions.RequestException as e:
        print(f"Ошибка загрузки id={university_id}: {e}")
        return {
            "year": year,
            "id": university_id,
            "university": university_name,
            "students": None
        }

    soup = BeautifulSoup(response.text, "lxml")

    students = None

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in row.find_all(["td", "th"])]

            if len(cells) >= 4:
                code = cells[0]
                indicator = cells[1].lower()
                value = cells[3]

                if code == "1" and "общая численность студентов" in indicator:
                    students = value
                    break

        if students is not None:
            break

    return {
        "year": year,
        "id": university_id,
        "university": university_name,
        "students": students
    }

def parse_one(data):
    university_id, university_name, year = data

    return parse_university(
        university_id,
        university_name,
        year
    )

search_words = [
    "университет",
    "институт",
    "академия",
    "медицинский",
    "педагогический"
]   

all_results = []
tasks = []

for year in years:
    print(f"\nГОД {year}")

    all_universities = {}

    for word in search_words:
        universities = get_universities(word, year)
        all_universities.update(universities)

        print(f"{year}, поиск '{word}': найдено {len(universities)} id")
        time.sleep(1)

    print(f"{year}: всего уникальных id:", len(all_universities))

    tasks.extend(
        (university_id, university_name, year)
        for university_id, university_name in all_universities.items()
    )

with ThreadPoolExecutor(max_workers=3) as executor:

    results = executor.map(parse_one, tasks)

    for index, result in enumerate(results, start=1):

        all_results.append(result)

        print(result["year"], index, result)

        if index % 20 == 0:
            df_backup = pd.DataFrame(all_results)

            df_backup.to_csv(
                "universities_students_backup.csv",
                index=False,
                encoding="utf-8-sig"
            )

df = pd.DataFrame(all_results)

df.to_csv("universities_students_2022_2025.csv", index=False, encoding="utf-8-sig")

print("Готово")
print(df)