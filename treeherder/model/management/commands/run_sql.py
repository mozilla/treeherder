import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.models import Datasource


class Command(BaseCommand):
    help = "Runs an arbitrary sql statement or file on a number of databases."

    def add_arguments(self, parser):
        parser.add_argument(
            '--datasources',
            action='store',
            dest='datasources',
            default='all',
            help='A comma separated list of datasources to execute the sql code on'
        )
        parser.add_argument(
            '-s', '--sql-statement',
            action='store',
            dest='sql_statement',
            help='Sql statement',
            default=''
        )
        parser.add_argument(
            '-f', '--file',
            dest='sql_file',
            help='Sql source file',
            metavar='FILE',
            default=""
        )

    def handle(self, *args, **options):

        sql_code = options["sql_statement"]

        if not sql_code:
            if options["sql_file"]:
                with open(options["sql_file"]) as sql_file:
                    sql_code = sql_file.read()
            else:
                self.stderr.write("Either a SQL statement or file must be specified! See --help.")
                return

        self.stdout.write("SQL command: {}".format(sql_code))

        datasources = Datasource.objects.all()
        if options['datasources'] != 'all':
            if ',' in options['datasources']:
                datasources = datasources.filter(
                    project__in=options['datasources'].split(','))
            else:
                datasources = datasources.filter(
                    project=options['datasources'])

        self.stdout.write("{0} datasource found".format(
            len(datasources)
        ))

        for datasource in datasources:
            self.stdout.write("--------------------------")
            db_options = settings.DATABASES['default'].get('OPTIONS', {})
            conn = MySQLdb.connect(
                host=settings.DATABASES['default']['HOST'],
                db=datasource.name,
                user=settings.DATABASES['default']['USER'],
                passwd=settings.DATABASES['default'].get('PASSWORD') or '',
                **db_options
            )
            try:
                cursor = conn.cursor()
                conn.autocommit(True)
                cursor.execute(sql_code)
                self.stdout.write("Sql code executed on {}:".format(datasource))
                for row in cursor:
                    self.stdout.write("  {}".format(row))
            except Exception as e:
                error_string = "!!! Sql code execution failed on {0} !!!"
                self.stderr.write(error_string.format(datasource))
                self.stderr.write("{0}".format(e))
            finally:
                if cursor:
                    cursor.close()
                conn.close()
