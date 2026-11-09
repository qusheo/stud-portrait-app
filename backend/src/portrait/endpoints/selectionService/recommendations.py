import json
import traceback

from django.db.models import OuterRef, Subquery
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ...models import ParticipantsWithNames
from ..helpers.helpers import (
    DESCENDING_LEVELS,
    FIELDS,
    INDICATORS,
    LEVELS,
    get_latest_results,
    serialize_student,
)
from backend.src.portrait.endpoints.selectionService.utils.projectToResultsMap import calculate_project_type_score