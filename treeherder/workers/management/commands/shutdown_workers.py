from django.core.management.base import BaseCommand
from celery.task.control import broadcast


class Command(BaseCommand):
    help = "Broadcast a warm shutdown event to all the workers."

    def handle(self, *args, **options):
        self.stdout.write("Sending shutdown event")
        broadcast("shutdown")
        self.stdout.write("Shutdown event sent")