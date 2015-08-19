import os
from optparse import make_option

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils.six.moves import input

from treeherder import path


class Command(BaseCommand):
    help = "Init master database and call syncdb"

    option_list = BaseCommand.option_list + (
        make_option('--noinput', action='store_false', dest='interactive', default=True,
                    help='Tells Django to NOT prompt the user for input of any kind.'
                    ),
        make_option('--engine',
                    action='store',
                    dest='engine',
                    default='InnoDB',
                    help='Define the db engine to use.',
                    ),
        make_option('--template-path',
                    action='store',
                    dest='template_path',
                    default=path('model', 'sql', 'template_schema'),
                    help='Directory containing the sql templates',
                    ),
        make_option('--skip-fixtures',
                    action='store_true',
                    dest='skip_fixtures',
                    default=False,
                    help='Tell this command to NOT load initial fixtures',
                    ),

    )

    def handle(self, *args, **options):
        interactive = options['interactive']
        if interactive:
            confirm = input("""You have requested an init of the database.
This will IRREVERSIBLY DESTROY all data currently in the %r database,
and return each table to the state it was in after syncdb.
Are you sure you want to do this?

Type 'yes' to continue, or 'no' to cancel: """ % connection.settings_dict['NAME'])
        else:
            confirm = 'yes'

        if confirm == 'yes':
            for sql_file in ('treeherder.sql.tmpl',
                             'treeherder_reference_1.sql.tmpl',
                             ):

                with open(os.path.join(options['template_path'], sql_file)) as f:
                    sql = f.read()
                cursor = connection.cursor()
                try:
                    rendered_sql = sql.format(engine=options['engine'])
                    cursor.execute(rendered_sql)
                except Exception as e:
                    print "Error on sql execution:{0}".format(e)
                finally:
                    cursor.close()
                print "Sql files executed successfully."

            # safely apply all migrations
            call_command("migrate", fake_initial=True, interactive=interactive)
            # load initial fixtures for reference data
            # the order of this list of fixtures is important
            # to avoid integrity errors
            if not options['skip_fixtures']:
                call_command('load_initial_data')
