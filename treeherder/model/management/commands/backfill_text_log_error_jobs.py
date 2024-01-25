import logging
from django.core.management.base import BaseCommand

from treeherder.model.models import TextLogError
from treeherder.utils.queryset import chunked_qs


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
    default is daily and non-test mode, use flags for weekly, auto and test mode."""

    def add_arguments(self, parser):
        parser.add_argument(
            "--chunk-size",
            action="store",
            dest="chunk_size",
            default=1000,
            type=int,
            help=("Define the size of the chunks for querying the TextLogError table"),
        )

    def handle(self, *args, **options):
        queryset = TextLogError.objects.select_related("step").filter(job__isnull=True)
        chunk_size = options["chunk_size"]

        for chunked_queryset in chunked_qs(
            queryset, chunk_size=chunk_size, fields=["id", "step", "job"]
        ):
            if not chunked_queryset:
                return

            for row in chunked_queryset:
                row.job_id = row.step.job_id

            TextLogError.objects.bulk_update(chunked_queryset, ["job"])

            logger.warning(
                "successfully added job_id in TextLogError table to rows {} to {}".format(
                    chunked_queryset[0].id, chunked_queryset[-1].id
                )
            )

        logger.warning("successfully finished backfilling job_ids in the TextLogError table")
