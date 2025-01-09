"""IMPORTANT!
This subcommand isn't intended for regular use.

The subcommand's sole purpose is to clean the database of dirty
performance_datum, in case a revert migration is needed.
"""

from django.core.management.base import BaseCommand

from treeherder.perf.models import MultiCommitDatum, PerformanceDatum


class Command(BaseCommand):
    help = "Remove all `performance_datum` rows ingested as multi commit data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--chunk-size",
            default=40,
            type=int,
            help="How many rows to delete at a time (this won't remove all rows in a single query, "
            "but in multiple, smaller ones).",
            metavar="CHUNK-SIZE",
        )

    def handle(self, *args, **options):
        data_to_delete = MultiCommitDatum.objects.all().values_list("perf_datum", flat=True)
        chunk_size = options["chunk_size"]

        if not data_to_delete:
            print("No data to delete")
            return

        print("Removing `performance_datum` rows ingested as multi commit data...")
        while data_to_delete:
            delete_now, data_to_delete = data_to_delete[:chunk_size], data_to_delete[chunk_size:]
            PerformanceDatum.objects.filter(id__in=delete_now).delete()
            print(f"\r{len(data_to_delete)} `performance_datum` rows left to delete", end="")
        print()
