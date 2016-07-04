import datetime
import string

import MySQLdb
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from treeherder.model.models import (BugJobMap,
                                     Datasource,
                                     Job,
                                     JobNote,
                                     Repository)


class Command(BaseCommand):

    help = 'Migrate existing bug job map and job notes to master database'

    @staticmethod
    def _get_mappings(repository, legacy_job_ids, legacy_emails):
        # mapping to new job ids
        job_id_pairs = Job.objects.filter(
            project_specific_id__in=legacy_job_ids,
            repository=repository).values_list('id',
                                               'project_specific_id')
        job_id_mapping = {project_specific_id: job_id for
                          job_id, project_specific_id in job_id_pairs}

        # mapping from email -> user objects
        email_user_pairs = User.objects.filter(
            email__in=legacy_emails).values_list('id', 'email')
        email_mapping = dict((email, user_id) for
                             (user_id, email) in email_user_pairs)

        return (job_id_mapping, email_mapping)

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

            #
            # Migrate bug job map
            #
            c.execute("""SELECT job_id, bug_id, submit_timestamp, who from bug_job_map""")
            ds_bug_job_maps = c.fetchall()

            (job_id_mapping, email_mapping) = self._get_mappings(
                repository,
                set([bjm[0] for bjm in ds_bug_job_maps]),
                set([bjm[3] for bjm in ds_bug_job_maps]))

            # migrate everything in one big bulk transaction (there aren't
            # that many)
            migrated_bug_job_maps = []
            for (ds_job_id, ds_bug_id, ds_timestamp,
                 ds_email) in ds_bug_job_maps:
                if not job_id_mapping.get(ds_job_id):
                    self.stderr.write("WARNING: job id {} not found when migrating bug job map, skipping\n".format(ds_job_id))
                    continue
                migrated_bug_job_maps.append(BugJobMap(
                    job_id=job_id_mapping[ds_job_id],
                    bug_id=ds_bug_id,
                    user_id=email_mapping.get(ds_email),
                    created=datetime.datetime.fromtimestamp(ds_timestamp)))
            BugJobMap.objects.bulk_create(migrated_bug_job_maps)

            #
            # Migrate job notes
            #
            c.execute("""SELECT job_id, failure_classification_id, who, note, note_timestamp from job_note""")
            ds_job_notes = c.fetchall()

            (job_id_mapping, email_mapping) = self._get_mappings(
                repository,
                set([jn[0] for jn in ds_job_notes]),
                set([jn[2] for jn in ds_job_notes]))
            migrated_job_notes = []
            for (ds_job_id, ds_failure_classification_id, ds_email,
                 ds_note_text, ds_timestamp) in ds_job_notes:
                if not job_id_mapping.get(ds_job_id):
                    self.stderr.write("WARNING: job id {} not found when migrating job notes, skipping\n".format(ds_job_id))
                    continue
                ds_note_text = filter(lambda x: x in set(string.printable),
                                      ds_note_text)
                migrated_job_notes.append(JobNote(
                    job_id=job_id_mapping[ds_job_id],
                    failure_classification_id=ds_failure_classification_id,
                    user_id=email_mapping.get(ds_email),
                    text=ds_note_text,
                    created=datetime.datetime.fromtimestamp(ds_timestamp)))
            JobNote.objects.bulk_create(migrated_job_notes)
