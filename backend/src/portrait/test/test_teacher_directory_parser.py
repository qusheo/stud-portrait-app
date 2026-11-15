import unittest

from portrait.endpoints.parsers.teacher_directory_parser import _education_type, _gender, _nullable_title, parse_teacher


HEADERS = [
    "№", "Фамилия, имя, отчество педагогического работника", "Занимаемая должность",
    "Преподаваемые учебные предметы", "Уровень (уровни) профессионального образования",
    "Учёная степень", "Учёное звание", "Сведения о повышении квалификации",
    "Сведения о профессиональной переподготовке", "Сведения о продолжительности опыта",
    "Образовательные программы",
]


def page(rows):
    headers = "".join(f"<th>{header}</th>" for header in HEADERS)
    return f"<table><tr>{headers}</tr>{rows}</table>"


class TeacherDirectoryParserTests(unittest.TestCase):
    def test_extracts_columns_and_infers_gender(self):
        cells = [
            "1", "Иванова Анна Петровна", "Доцент",
            "<div class='showpart-container-list'>Математика;<br>Физика;</div>"
            "<span class='showpart-btn-list'>показать все</span>",
            "Высшее образование<br>Математика<br>Математик",
            "Кандидат наук", "Доцент",
            "<div class='showpart-container-list'>1. 2024 Курс А2. 2025 Курс Б</div>",
            "Не проходил(-а)", "менее 1 года", "",
        ]
        row = "<tr>" + "".join(f"<td>{cell}</td>" for cell in cells) + "</tr>"
        record = parse_teacher(page(row))[0]
        self.assertEqual(record.name, "Иванова Анна Петровна")
        self.assertEqual(record.gender, "Женский")
        self.assertEqual(record.disciplines, ["Математика", "Физика"])
        self.assertEqual(record.education_type, "Высшее образование")
        self.assertEqual(record.qualification, "Математик")
        self.assertEqual(record.professional_development, ["2024 Курс А", "2025 Курс Б"])
        self.assertEqual(record.professional_retraining, [])
        self.assertEqual(record.experience, 0)

    def test_rejects_wrong_table(self):
        with self.assertRaises(ValueError):
            parse_teacher("<table><tr><td>Other data</td></tr></table>")

    def test_gender_requires_a_recognized_ending(self):
        self.assertEqual(_gender('Иванов Иван Петрович'), 'Мужской')
        self.assertEqual(_gender('Иванова Анна Петровна'), 'Женский')
        self.assertIsNone(_gender('Ли Алексей'))

    def test_education_and_missing_titles(self):
        self.assertEqual(_education_type('Высшее образование - магистратура'), 'Магистратура')
        self.assertIsNone(_nullable_title('Отсутствует'))

    def test_keeps_duplicate_names_as_separate_rows(self):
        def row(number):
            cells = [str(number), "Иванова Анна Петровна"] + [""] * 9
            return "<tr>" + "".join(f"<td>{cell}</td>" for cell in cells) + "</tr>"
        records = parse_teacher(page(row(1) + row(2)))
        self.assertEqual([record.source_row for record in records], [1, 2])


if __name__ == "__main__":
    unittest.main()
