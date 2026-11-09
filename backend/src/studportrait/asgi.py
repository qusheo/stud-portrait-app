import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'studportrait.settings')

application = get_asgi_application()

if os.getenv("PYROSCOPE_ENABLED") == "1":
    try:
        import pyroscope
    except ImportError:
        pyroscope = None

    if pyroscope is not None:
        pyroscope.configure(
            application_name="studportrait.backend",
            server_address=os.getenv("PYROSCOPE_SERVER_ADDRESS", "http://pyroscope:4040"),
            sample_rate=100,
            cpu_enabled=True,
            oncpu=True,
            mem_enabled=False,
        )