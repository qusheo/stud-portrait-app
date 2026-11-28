from django.db import connection
from django.test import TestCase

from ..models import (
    Academicperformances,
    Competencecenters,
    Courseresults,
    CurriculumParseLog,
    Datauploadtemplate,
    DisciplineCompetencyMapping,
    Educationdisciplines,
    Educationforms,
    Educationlevels,
    Educationspecialties,
    Institutions,
    Participants,
    ParticipantsWithNames,
    Results,
    Specialties,
    Studentmapping,
    StudentsAmount,
    Studyforms,
)


def create_test_tables():
    existing_tables = set(connection.introspection.table_names())
    test_models = (
        Competencecenters,
        Institutions,
        Educationlevels,
        Educationforms,
        Educationspecialties,
        Specialties,
        Studyforms,
        Educationdisciplines,
        Participants,
        Studentmapping,
        ParticipantsWithNames,
        Results,
        Courseresults,
        Academicperformances,
        Datauploadtemplate,
        StudentsAmount,
        DisciplineCompetencyMapping,
        CurriculumParseLog,
    )

    with connection.schema_editor() as schema_editor:
        for model in test_models:
            if model._meta.db_table not in existing_tables:
                schema_editor.create_model(model)


class BaseTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        create_test_tables()
