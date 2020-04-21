#!/usr/bin/env python

import os
import sys
import warnings

# Display deprecation warnings, which are hidden by default:
# https://docs.python.org/3.7/library/warnings.html#default-warning-filters
warnings.simplefilter('default', DeprecationWarning)

# Suppress noisy warnings from dependencies

# Reported in https://support.newrelic.com/tickets/338064
warnings.filterwarnings('ignore', category=DeprecationWarning, module='newrelic')

# https://github.com/encode/django-rest-framework/issues/6317
warnings.filterwarnings('ignore', category=DeprecationWarning, module='markdown.util')

# "Using or importing the ABCs from 'collections' instead of from 'collections.abc' is deprecated, and in 3.8 it will stop working"
# corsheaders/checks.py -> https://github.com/ottoyiu/django-cors-headers/issues/374
# jinja2/runtime.py -> https://github.com/pallets/jinja/pull/867
# orderedmultidict/orderedmultidict.py -> https://github.com/gruns/orderedmultidict/pull/20
# promise/promise_list.py -> https://github.com/syrusakbary/promise/pull/67
warnings.filterwarnings(
    'ignore', category=DeprecationWarning, message=r'Using or importing the ABCs .*'
)

# "the imp module is deprecated in favour of importlib; see the module's documentation for alternative uses"
warnings.filterwarnings('ignore', category=DeprecationWarning, module='celery.utils.imports')

if __name__ == "__main__":
    os.environ["DJANGO_SETTINGS_MODULE"] = "treeherder.config.settings"

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
