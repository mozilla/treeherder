from django.core.management.base import BaseCommand

from treeherder.model.models import TextLogError
from treeherder.utils.queryset import chunked_qs


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
       default is daily and non-test mode, use flags for weekly, auto and test mode."""

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=1000,
            type=int,
            help=('Define the size of the chunks for querying the TextLogError table'),
        )

    def handle(self, *args, **options):
        queryset = TextLogError.objects.filter(job__isnull=True)

        for queryset in chunked_qs(
            queryset, chunk_size=options['chunk_size'], fields=['id', 'step', 'job']
        ):
            for row in queryset:
                row.job_id = row.step.job_id
                row.save()
