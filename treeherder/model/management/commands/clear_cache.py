# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.cache import cache
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "A simple command to clear the cache."

    def handle(self, *args, **options):
        cache.clear()
