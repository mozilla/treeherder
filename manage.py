#!/usr/bin/env python

import os
import sys
import warnings

# Display deprecation warnings, which are hidden by default:
# https://docs.python.org/3.7/library/warnings.html#default-warning-filters
warnings.simplefilter('default', DeprecationWarning)

if __name__ == "__main__":
    os.environ["DJANGO_SETTINGS_MODULE"] = "treeherder.config.settings"

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
