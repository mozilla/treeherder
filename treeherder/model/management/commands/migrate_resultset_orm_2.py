import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.models import Datasource


class Command(BaseCommand):

    help = 'Migrate per-project resultset (push) and revision information to master database'

    def handle(self, *args, **options):

        for ds in Datasource.objects.all():
            self.stdout.write('{}\n'.format(ds.project))

            db_options = settings.DATABASES['default'].get('OPTIONS', {})
            db = MySQLdb.connect(
                host=settings.DATABASES['default']['HOST'],
                db=ds.name,
                user=settings.DATABASES['default']['USER'],
                passwd=settings.DATABASES['default'].get('PASSWORD') or '',
                **db_options
            )
            c = db.cursor()

            try:
                c.execute('alter table job modify column push_id int(10) unsigned NOT NULL;')
            except:
                pass
