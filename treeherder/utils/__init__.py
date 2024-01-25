from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__) / ".." / ".." / ".."


def default_serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
