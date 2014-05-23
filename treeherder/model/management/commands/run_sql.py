import MySQLdb
from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.model.models import Datasource
from django.conf import settings


class Command(BaseCommand):
    help = ("Runs an arbitrary sql statement or file"
            " on a number of databases.")

    option_list = BaseCommand.option_list + (

        make_option(
            '--datasources',
            action='store',
            dest='datasources',
            default='all',
            help='A comma separated list of datasources to execute the sql code on'),

        make_option(
            '--data-type',
            action='store',
            dest='data_type',
            default='jobs',
            choices=['jobs', 'objectstore'],
            help='The target data-type of the sql code'),

        make_option(
            '-f', '--file',
            dest='sql_file',
            help='Sql source file',
            metavar='FILE',
            default="")

    )

    def handle(self, *args, **options):

        if not options["sql_file"]:
            self.stderr.write("No sql file provided!")
            return

        datasources = Datasource.objects.filter(contenttype=options['data_type'])
        if options['datasources'] != 'all':
            if ',' in options['datasources']:
                datasources = datasources.filter(
                    project__in=options['datasources'].split(','))
            else:
                datasources = datasources.filter(
                    project=options['datasources'])

        with open(options["sql_file"]) as sql_file:
            sql_code = sql_file.read()

            self.stdout.write("{0} datasource found".format(
                len(datasources)
            ))
            for datasource in datasources:
                self.stdout.write("--------------------------")
                db = MySQLdb.connect(
                    host=datasource.host,
                    db=datasource.name,
                    user=settings.TREEHERDER_DATABASE_USER,
                    passwd=settings.TREEHERDER_DATABASE_PASSWORD)
                try:
                    cursor = db.cursor()
                    cursor.execute(sql_code)
                    self.stdout.write("Sql code executed on {0}".format(datasource))
                except Exception as e:
                    error_string = "!!! Sql code execution failed on {0} !!!"
                    self.stderr.write(error_string.format(datasource))
                    self.stderr.write("{0}".format(e))
                finally:
                    if cursor:
                        cursor.close()
