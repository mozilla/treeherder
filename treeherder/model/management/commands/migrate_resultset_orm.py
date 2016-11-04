import datetime
from optparse import make_option

import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.utils import IntegrityError
from django.utils.encoding import (DjangoUnicodeDecodeError,
                                   smart_text)

from treeherder.etl.text import astral_filter
from treeherder.model.models import (Commit,
                                     Datasource,
                                     Job,
                                     Push,
                                     Repository)
from treeherder.perf.models import (PerformanceAlertSummary,
                                    PerformanceDatum)


class Command(BaseCommand):

    help = 'Migrate per-project resultset (push) and revision information to master database'

    option_list = BaseCommand.option_list + (
        make_option(
            '--skip-existing',
            action='store_true',
            dest='skip_existing',
            default=False,
            help='Don\'t migrate existing resultsets'),
    )

    @staticmethod
    def _get_unicode_string(author):
        try:
            return astral_filter(smart_text(author))
        except DjangoUnicodeDecodeError:
            # in certain annoying cases it seems like a field that should be
            # utf-8 is specified in extended ascii (pretty sure this is a mysql
            # issue, since mercurial/github should store/return in utf-8), so
            # do a conversion
            return author.decode('iso-8859-1')

    def _process_push(self, c, repository, rs_id, revision_hash,
                      short_revision, long_revision, author, push_timestamp,
                      skip_existing):
        # use the long revision if available, otherwise fall back to
        # short revision (I believe the long revision is always available
        # but I guess you never know)
        revision = long_revision or short_revision
        if not revision:
            print "Empty revision for result set {}, skipping".format(rs_id)
            return
        try:
            print rs_id,
            push = Push.objects.get(repository=repository,
                                    revision__startswith=revision[:12])
            if skip_existing:
                # already exists and we're skipping existing entries
                return
        except Push.DoesNotExist:
            # set the revision hash property to null if it has no length
            revision_hash = revision_hash or None
            push = Push.objects.create(
                repository=repository,
                revision=revision,
                revision_hash=revision_hash,
                author=self._get_unicode_string(author),
                time=datetime.datetime.fromtimestamp(push_timestamp))

        #
        # update any jobs
        #
        c.execute(
            """
            UPDATE job set push_id={} where result_set_id={}
            """.format(push.id, rs_id))

        #
        # update intermediate jobs table
        #
        c.execute(
            """
            SELECT id from job where result_set_id={}
            """.format(rs_id))
        legacy_job_ids = [int(id[0]) for id in c.fetchall()]
        Job.objects.filter(
            repository=repository,
            project_specific_id__in=legacy_job_ids,
            push=None).update(push=push)

        #
        # get revisions corresponding to this push, create them
        #
        c.execute(
            """
            SELECT revision_id from revision_map where result_set_id={}
            """.format(rs_id))
        revision_ids = c.fetchall()
        if revision_ids:
            c.execute(
                """
                SELECT revision, author, comments from revision where id in ({})
                """.format(','.join(['%s' % rev_id for rev_id in revision_ids])))
            for (revision, author, comments) in c.fetchall():
                try:
                    Commit.objects.create(
                        push=push,
                        revision=revision,
                        author=self._get_unicode_string(author),
                        comments=self._get_unicode_string(comments))
                except IntegrityError:
                    # this revision already seems to exist, ok
                    pass
        else:
            print "\nNo revisions for result set id {}".format(rs_id)

        #
        # update any performance data with this result set id
        #
        PerformanceDatum.objects.filter(repository=repository,
                                        result_set_id=rs_id,
                                        push=None).update(
                                            push=push)
        PerformanceAlertSummary.objects.filter(
            repository=repository,
            prev_result_set_id=rs_id,
            prev_push=None).update(prev_push=push)
        PerformanceAlertSummary.objects.filter(
            repository=repository,
            result_set_id=rs_id,
            push=None).update(push=push)

    def handle(self, *args, **options):

        for ds in Datasource.objects.all():
            self.stdout.write('{}\n'.format(ds.project))
            try:
                repository = Repository.objects.get(name=ds.project)
            except:
                self.stderr.write('No repository for datasource project {}, skipping\n'.format(
                    ds.project))
                continue

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
                c.execute('alter table job add column push_id int(10) unsigned default NULL;')
                c.execute('create index idx_push_id on job (push_id);')
            except:
                pass

            c.execute("""SELECT id, revision_hash, short_revision, long_revision, author, push_timestamp from result_set""")
            ds_resultsets = c.fetchall()

            for (rs_id, revision_hash, short_revision, long_revision,
                 author, push_timestamp) in ds_resultsets:
                self._process_push(c, repository, rs_id, revision_hash,
                                   short_revision, long_revision, author,
                                   push_timestamp, options['skip_existing'])
                db.commit()
