import csv
import tempfile
import unittest

import pandas as pd

from portrait.endpoints.parsers.load_students_amount import (
    clean_students_count,
    normalize_name,
    read_preview_mapping,
)


class CleanStudentsCountTests(unittest.TestCase):
    def test_plain_digits(self):
        self.assertEqual(clean_students_count("12345"), 12345)

    def test_spaces_and_nbsp_are_removed(self):
        self.assertEqual(clean_students_count("12 345"), 12345)
        self.assertEqual(clean_students_count("12 345"), 12345)

    def test_none_and_nan(self):
        self.assertIsNone(clean_students_count(None))
        self.assertIsNone(clean_students_count(float("nan")))

    def test_non_numeric_returns_none(self):
        self.assertIsNone(clean_students_count("abc"))
        self.assertIsNone(clean_students_count("12a"))
        self.assertIsNone(clean_students_count(""))


class NormalizeNameTests(unittest.TestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(normalize_name("  Тюменский  государственный  университет "), "Тюменский государственный университет")

    def test_handles_none_like_input(self):
        self.assertEqual(normalize_name(None), "None")


class ReadPreviewMappingTests(unittest.TestCase):
    def write_csv(self, rows):
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8", newline=""
        )
        writer = csv.DictWriter(
            tmp, fieldnames=["source_id", "inst_ids", "database_names", "status"], delimiter=";"
        )
        writer.writeheader()
        writer.writerows(rows)
        tmp.close()
        return tmp.name

    def test_reads_only_candidate_rows(self):
        path = self.write_csv([
            {"source_id": "100", "inst_ids": "5", "database_names": "ВУЗ А", "status": "candidate"},
            {"source_id": "200", "inst_ids": "6", "database_names": "ВУЗ Б", "status": "rejected"},
        ])
        mapping = read_preview_mapping(path)
        self.assertEqual(mapping, {"100": (5, "ВУЗ А")})

    def test_empty_report(self):
        path = self.write_csv([])
        self.assertEqual(read_preview_mapping(path), {})


class ImportBatchHelpersTests(unittest.TestCase):
    def test_clean_count_applied_to_dataframe_like_values(self):
        self.assertEqual(clean_students_count(pd.NA), None)


if __name__ == "__main__":
    unittest.main()
