import requests
from bs4 import BeautifulSoup
import pandas as pd
import time


headers = {
    "User-Agent": "Mozilla/5.0"
}


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


years = range(2022, 2026)

search_words = [
    "университет",
    "институт",
    "академия",
    "медицинский",
    "педагогический"
]   

all_results = []

for year in years:
    print(f"\nГОД {year}")

    all_universities = {}

    for word in search_words:
        universities = get_universities(word, year)
        all_universities.update(universities)

        print(f"{year}, поиск '{word}': найдено {len(universities)} id")
        time.sleep(1)

    print(f"{year}: всего уникальных id:", len(all_universities))

    for index, (university_id, university_name) in enumerate(all_universities.items(), start=1):
        result = parse_university(university_id, university_name, year)
        all_results.append(result)

        print(year, index, result)

        if index % 20 == 0:
            df_backup = pd.DataFrame(all_results)
            df_backup.to_csv("universities_students_2022_2025_backup.csv", index=False, encoding="utf-8-sig")
            print("Файл сохранён")

        time.sleep(0.2)

df = pd.DataFrame(all_results)

df.to_csv("universities_students_2022_2025.csv", index=False, encoding="utf-8-sig")

print("Готово")
print(df)