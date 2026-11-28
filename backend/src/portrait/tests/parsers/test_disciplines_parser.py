import unittest

import pandas as pd

from portrait.endpoints.parsers.disciplines_parser import (
    _extract_rows_by_name,
    _extract_year,
    _parse_competency_codes,
    RSV_DISPLAY_TO_KEY,
    STANDARD_COMPETENCIES,
)


class ExtractYearTests(unittest.TestCase):
    def test_finds_first_year(self):
        self.assertEqual(_extract_year("Учебный план 2024 года"), "2024")

    def test_returns_none_without_year(self):
        self.assertIsNone(_extract_year("без даты"))

    def test_finds_year_in_href_text(self):
        self.assertEqual(_extract_year("plan_2021_2022.pdf"), "2021")


class ParseCompetencyCodesTests(unittest.TestCase):
    def test_single_code(self):
        self.assertEqual(_parse_competency_codes("УК-1"), ["УК-1"])

    def test_repeated_prefix_is_carried_over(self):
        self.assertEqual(
            _parse_competency_codes("УК-1,3, ОПК-2,4"),
            ["УК-1", "УК-3", "ОПК-2", "ОПК-4"],
        )

    def test_empty_and_nan(self):
        self.assertEqual(_parse_competency_codes(""), [])
        self.assertEqual(_parse_competency_codes(float("nan")), [])

    def test_skips_blank_parts(self):
        self.assertEqual(_parse_competency_codes("УК-1,,УК-2"), ["УК-1", "УК-2"])


class ExtractRowsByNameTests(unittest.TestCase):
    def setUp(self):
        self.df = pd.DataFrame(
            [
                ["Математика", "зач", "", "УК-1"],
                ["Управление проектами", "", "экз", "УК-3"],
                ["Физика", "", "", "УК-1"],
            ],
            columns=["Дисциплина", "Семестр 1", "Семестр 2", "Компетенции"],
        )

    def test_extracts_requested_rows_case_insensitive(self):
        result = _extract_rows_by_name(self.df, ["управление проектами"])
        self.assertEqual(len(result), 1)

    def test_empty_df_returns_empty_result(self):
        result = _extract_rows_by_name(pd.DataFrame(), ["Математика"])
        self.assertTrue(result.empty)

    def test_unknown_name_returns_empty_result(self):
        result = _extract_rows_by_name(self.df, ["Астрономия"])
        self.assertTrue(result.empty)


class CompetencyCatalogueTests(unittest.TestCase):
    def test_standard_competencies_have_unique_codes(self):
        self.assertEqual(len(STANDARD_COMPETENCIES), len(set(STANDARD_COMPETENCIES)))

    def test_rsv_display_names_map_to_res_comp_keys(self):
        for display_name, key in RSV_DISPLAY_TO_KEY.items():
            self.assertTrue(
                key.startswith("res_comp_"),
                f"{display_name} mapped to unexpected key {key}",
            )


if __name__ == "__main__":
    unittest.main()
