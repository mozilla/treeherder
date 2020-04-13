from datetime import datetime


def default_serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
