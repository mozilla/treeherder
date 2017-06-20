from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Populate the job_group field on the jobs table with existing foreign keys on the job_type table"

    def handle(self, *args, **options):

        cursor = connection.cursor()
        cursor.execute((
            "UPDATE job "
            "JOIN job_type jt ON job.job_type_id = jt.id "
            "SET job.job_group_id = jt.job_group_id;"
        ))
