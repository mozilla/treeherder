from treeherder.config import settings


def has_valid_explicit_days(func):
    def wrapper(*args, **kwargs):
        days = kwargs.get('days')
        if (days is not None) and settings.SITE_HOSTNAME != 'treeherder-prototype2.herokuapp.com':
            raise ValueError(
                'Cannot override perf data retention parameters on projects other than treeherder-prototype2'
            )
        func(*args, **kwargs)

    return wrapper
