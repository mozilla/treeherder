from django.core.cache import cache
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "A simple command to clear the cache."

    def handle(self, *args, **options):
        cache.clear()
