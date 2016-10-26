import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection

from treeherder.model.models import TextLogSummaryLine

logging.basicConfig()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Remove duplicate TextLogSummaryLines'

    def handle(self, *args, **options):
        try:
            self.remove_duplicates()
        except Exception:
            import traceback
            print traceback.format_exc()
            import pdb
            pdb.post_mortem()

    def remove_duplicates(self):
        group_size = 50000
        with connection.cursor() as cursor:
            cursor.execute("""
SELECT id
FROM text_log_summary
ORDER BY id DESC
LIMIT 1""")
            max_text_log_summary_id = cursor.fetchone()[0]
        upper_limit = max_text_log_summary_id
        while upper_limit > 0:
            lower_limit = max(upper_limit - group_size, 0)
            self.ping()
            with connection.cursor() as cursor:
                cursor.execute("""
SELECT text_log_summary_line.id,
       text_log_summary_line.failure_line_id,
       s.c
FROM text_log_summary_line
JOIN (SELECT t.failure_line_id, t.c AS c
      FROM (SELECT text_log_summary_line.failure_line_id,
            COUNT(text_log_summary_line.failure_line_id) AS c
            FROM text_log_summary_line
            JOIN text_log_summary on text_log_summary.id = text_log_summary_line.summary_id
            WHERE text_log_summary_line.failure_line_id IS NOT NULL AND
                  text_log_summary.id BETWEEN %s AND %s
            GROUP BY text_log_summary_line.failure_line_id
            HAVING c > 1)
      AS t)
AS s
ON s.failure_line_id = text_log_summary_line.failure_line_id
ORDER BY text_log_summary_line.id ASC""", [lower_limit, upper_limit])
                rows_duplicate_failure_line = cursor.fetchall()

            self.ping()
            with connection.cursor() as cursor:
                cursor.execute("""
SELECT text_log_summary_line.id,
       text_log_summary_line.summary_id,
       text_log_summary_line.line_number,
       s.c
FROM text_log_summary_line
JOIN (SELECT t.summary_id,
             t.line_number,
             t.c AS c
      FROM (SELECT text_log_summary_line.summary_id,
                   text_log_summary_line.line_number,
                   COUNT(*) AS c
            FROM text_log_summary_line
            JOIN text_log_summary on text_log_summary.id = text_log_summary_line.summary_id
            WHERE text_log_summary_line.line_number IS NOT NULL AND
                  text_log_summary.id BETWEEN %s AND %s
            GROUP BY text_log_summary_line.summary_id,
                     text_log_summary_line.line_number
            HAVING c > 1)
      AS t)
AS s
ON s.summary_id = text_log_summary_line.summary_id AND
   s.line_number = text_log_summary_line.line_number
ORDER BY text_log_summary_line.failure_line_id DESC,
         text_log_summary_line.id ASC;
""", [lower_limit, upper_limit])
                rows_duplicate_line_number = cursor.fetchall()

            upper_limit -= group_size

            to_delete = []

            logger.info("Processing %i summary lines with failure line" %
                        len(rows_duplicate_failure_line))
            to_delete.extend(self.ids_to_delete(rows_duplicate_failure_line))

            logger.info("Processing %i summary lines without failure line" %
                        len(rows_duplicate_line_number))
            to_delete.extend(self.ids_to_delete(rows_duplicate_line_number))

            logger.info("Deleting %i duplicate lines" %
                        len(to_delete))

            self.ping()
            TextLogSummaryLine.objects.filter(id__in=to_delete).delete()

    def ids_to_delete(self, rows):
        to_delete = []
        counts_by_line = {}
        ids_by_line = defaultdict(list)
        for row in rows:
            text_log_summary_line_id = row[0]
            count = row[-1]
            key = tuple(row[1:-1])
            ids_by_line[key].append(text_log_summary_line_id)
            if key in counts_by_line:
                assert counts_by_line[key] == count
            counts_by_line[key] = count

        for line_id, ids in ids_by_line.iteritems():
            assert len(ids) > 1
            assert len(ids) == counts_by_line[line_id]
            to_delete.extend(ids[1:])

        return to_delete

    def ping(self):
        connection.ensure_connection()
