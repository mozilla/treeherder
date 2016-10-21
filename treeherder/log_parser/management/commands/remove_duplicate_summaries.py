import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection

from treeherder.model.models import TextLogSummaryLine

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Remove duplicate TextLogSummaryLines'

    def handle(self, *args, **options):
        limit = 1000
        while True:
            with connection.cursor() as cursor:
                cursor.execute("""
SELECT failure_line_id, c
FROM (SELECT failure_line_id, COUNT(failure_line_id) AS c
      FROM text_log_summary_line
      WHERE failure_line_id IS NOT NULL
      GROUP BY failure_line_id
      HAVING c > 1) as t LIMIT %s""", [limit])
                rows = cursor.fetchall()
            if not rows:
                break
            logger.debug("Processing %i summary lines with failure line" % len(rows))
            to_delete = []
            count_by_failure_line = {failure_line_id: count for failure_line_id, count in rows}

            text_log_summary_lines = (TextLogSummaryLine.objects
                                      .filter(failure_line_id__in=count_by_failure_line.keys())
                                      .order_by('id')
                                      .values_list('id', 'failure_line_id'))
            ids_by_failure_line = defaultdict(list)
            for id, failure_line_id in text_log_summary_lines:
                ids_by_failure_line[failure_line_id].append(id)

            for failure_line_id, ids in ids_by_failure_line.iteritems():
                assert failure_line_id
                assert len(ids) == count_by_failure_line[failure_line_id]
                to_delete.extend(list(ids)[1:])

            TextLogSummaryLine.objects.filter(id__in=to_delete).delete()

        while True:
            with connection.cursor() as cursor:
                cursor.execute("""
SELECT summary_id, line_number, c
FROM (SELECT summary_id, line_number, COUNT(*) AS c
      FROM text_log_summary_line
      WHERE line_number IS NOT NULL AND
            failure_line_id IS NULL
      GROUP BY summary_id, line_number
      HAVING c > 1) as t LIMIT %s""", [limit])
                rows = cursor.fetchall()
            if not rows:
                break
            logger.debug("Processing %i summary lines without failure line" % len(rows))
            to_delete = []

            for summary_id, line_number, count in rows:
                text_log_summary_lines = (TextLogSummaryLine.objects
                                          .filter(summary_id=summary_id,
                                                  line_number=line_number)
                                          .order_by('id')
                                          .values_list('id', flat=True))
                assert len(text_log_summary_lines) == count
                to_delete.extend(text_log_summary_lines[1:])

            TextLogSummaryLine.objects.filter(id__in=to_delete).delete()
