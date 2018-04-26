import importlib
import pkgutil

from django.core.management.base import (BaseCommand,
                                         CommandError)


class Command(BaseCommand):
    """
    Convenience wrapper around running the autoclassification prototypes
    """
    def add_arguments(self, parser):
        parser.add_argument(
            'test',
            action='store',
            help='which test to run'
        )

    def handle(self, *args, **options):
        module = options['test']

        available_modules = [name for _, name, _ in pkgutil.iter_modules(['search'])]
        if module not in available_modules:
            formatted_availabe = ', '.join(available_modules)
            msg = 'Module "{}" not found in available modules: {}'
            raise CommandError(msg.format(module, formatted_availabe))

        mod = importlib.import_module('search.{}'.format(module))
        mod.run()
