import os
from optparse import make_option

from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command
from django.utils.six.moves import input

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
            default='treeherder/model/sql/template_schema/',
            help='Directory containing the sql templates',
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
                                 'treeherder_reference_1.sql.tmpl'):

                sql = open(os.path.join(options['template_path'], sql_file)).read()
                cursor = connection.cursor()
                try:
                    rendered_sql = sql.format(engine=options['engine'])
                    cursor.execute(rendered_sql)
                except Exception, e:
                    print "Error on sql execution:{0}".format(e)
                finally:
                    cursor.close()
                print "Sql files executed successfully."

            #flush all the apps not under south
            call_command("syncdb", interactive=False,)
            #fake the first migration because manually generated
            call_command("migrate", 'webapp','0001',fake=True)
            #safely apply all the other migrations
            call_command("migrate", 'webapp')
