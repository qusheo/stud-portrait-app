from django.contrib import admin
from . import models

for model_name, model in models.__dict__.items():
    if isinstance(model, type) and hasattr(model, '_meta'):
        try:
            admin.site.register(model)
        except admin.sites.AlreadyRegistered:
            pass