from celery.task.control import broadcast
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Broadcast a warm shutdown event to all the workers."

    def handle(self, *args, **options):
        self.stdout.write("Sending shutdown event")
        broadcast("shutdown")
        self.stdout.write("Shutdown event sent")
