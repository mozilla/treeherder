# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.management.base import BaseCommand
from celery.task.control import broadcast


class Command(BaseCommand):
    help = "Broadcast a warm shutdown event to all the workers."

    def handle(self, *args, **options):
        self.stdout.write("Sending shutdown event")
        broadcast("shutdown")
        self.stdout.write("Shutdown event sent")
