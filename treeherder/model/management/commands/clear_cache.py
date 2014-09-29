from django.core.management.base import BaseCommand
from django.core.cache import cache


class Command(BaseCommand):
    help = "A simple command to clear the cache."

    def handle(self, *args, **options):
        cache.clear()
