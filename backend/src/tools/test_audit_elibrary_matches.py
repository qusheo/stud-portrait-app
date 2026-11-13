import hashlib
from pathlib import Path
import tempfile
import unittest

from audit_elibrary_matches import prepare as audit, tyumgu_affiliation
from elibrary_lists import ListStore
from parse_elibrary import Listing
from prepare_elibrary_sample import prepare
from test_match_elibrary_lists import TEACHERS, publication


class AuditTests(unittest.TestCase):
    def test_affiliations_do_not_mix_tyumen_universities(self):
        self.assertTrue(tyumgu_affiliation('Тюменский государственный университет, Тюмень'))
        self.assertTrue(tyumgu_affiliation('Ишимский педагогический институт им. П. П. Ершова (филиал) ТюмГУ'))
        self.assertTrue(tyumgu_affiliation('University of Tyumen'))
        self.assertFalse(tyumgu_affiliation('Тюменский государственный медицинский университет'))
        self.assertFalse(tyumgu_affiliation('Тюменский индустриальный университет'))

    def test_grouping_is_by_author_position_and_audit_is_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            store=ListStore(directory)
            entries=[dict(publication(1,['Петров И.И.']),bibliography='2026',metadata_source='listing'),
                     dict(publication(2,['Сидорова А.С.'],True),bibliography='2026',metadata_source='listing'),
                     dict(publication(3,[]),bibliography='2026',metadata_source='listing')]
            store.save_page('test',1,Listing([1,2,3],1,3,1),entries,{})
            store.db.close()
            sample=Path(directory)/'sample'
            prepare(directory,TEACHERS,'hash',sample)
            database=sample/'analysis.sqlite3'
            before=hashlib.sha256(database.read_bytes()).hexdigest()
            report=audit(database,sample/'quality',3)
            self.assertEqual(report['matched_author_positions'],2)
            self.assertEqual(report['candidate_pairs'],3)
            self.assertEqual(report['author_positions_by_category']['ambiguous_initials'],1)
            self.assertEqual(report['author_positions_by_category']['single_directory_candidate'],1)
            self.assertEqual(report['sample_size'],3)
            self.assertEqual(before,hashlib.sha256(database.read_bytes()).hexdigest())


if __name__=='__main__':
    unittest.main()
