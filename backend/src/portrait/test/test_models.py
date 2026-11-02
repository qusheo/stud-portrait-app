from portrait.models import Participants, Results

from .test_backend import BaseTestCase


class TestParticipantsModel(BaseTestCase):
    def test_participant_creation(self):
        participant = Participants.objects.create(
            part_rsv_id='MODEL001',
            part_course_num=2,
            part_gender=1,
        )

        self.assertEqual(participant.part_rsv_id, 'MODEL001')
        self.assertIsNotNone(participant.part_id)


class TestResultsModel(BaseTestCase):
    def setUp(self):
        self.participant = Participants.objects.create(part_rsv_id='MODEL002')

    def test_result_creation(self):
        result = Results.objects.create(
            res_participant=self.participant,
            res_year='2023/2024',
            res_course=2,
            res_comp_communication=385,
            res_comp_info_analysis=490,
            res_mot_purpose=375,
        )

        self.assertEqual(result.res_participant, self.participant)
        self.assertEqual(result.res_year, '2023/2024')
        self.assertEqual(result.res_comp_communication, 385)
        self.assertIsNotNone(result.res_id)

    def test_foreign_key_relationship(self):
        result = Results.objects.create(
            res_participant=self.participant,
            res_year='2024/2025',
            res_course=3,
        )

        self.assertEqual(result.res_participant.part_id, self.participant.part_id)
        self.assertEqual(result.res_participant.part_rsv_id, self.participant.part_rsv_id)
