# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

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
            help=('The target data-type of the sql code (jobs or objectstore, '
                  'default jobs)')),

        make_option(
            '-s', '--sql-statement',
            action='store',
            dest='sql_statement',
            help='Sql statement',
            default=''),

        make_option(
            '-f', '--file',
            dest='sql_file',
            help='Sql source file',
            metavar='FILE',
            default="")

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

        datasources = Datasource.objects.filter(contenttype=options['data_type'])
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
            conn = MySQLdb.connect(
                host=datasource.host,
                db=datasource.name,
                user=settings.TREEHERDER_DATABASE_USER,
                passwd=settings.TREEHERDER_DATABASE_PASSWORD)
            try:
                cursor = conn.cursor()
                cursor.execute(sql_code)
                conn.commit()
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
