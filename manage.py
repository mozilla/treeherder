#!/usr/bin/env python

import os
import sys
import warnings

# Display deprecation warnings, which are hidden by default:
# https://docs.python.org/2.7/library/warnings.html#default-warning-filters
warnings.simplefilter('default', DeprecationWarning)

# Suppress noisy warnings from dependencies
# Reported in https://support.newrelic.com/tickets/338064
warnings.filterwarnings('ignore', category=DeprecationWarning, module='newrelic.api.import_hook')
# Remove when we update to Kombu 4+ (bug 1337717)
warnings.filterwarnings('ignore', category=DeprecationWarning, module='kombu.five')
# https://github.com/encode/django-rest-framework/issues/6317
warnings.filterwarnings('ignore', category=DeprecationWarning, module='markdown.util')

if __name__ == "__main__":
    os.environ["DJANGO_SETTINGS_MODULE"] = "treeherder.config.settings"

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
