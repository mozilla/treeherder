# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os
# This will make sure the app is always imported when
# Django starts so that shared_task will use this app.
from .celery import app as celery_app  # noqa

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
path = lambda *a: os.path.join(PROJECT_DIR, *a)
