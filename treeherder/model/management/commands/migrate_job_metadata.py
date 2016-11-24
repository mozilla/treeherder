import datetime

import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import (connection,
                       transaction)

from treeherder.model.models import (Datasource,
                                     Job,
                                     ReferenceDataSignatures,
                                     Repository)


class Command(BaseCommand):

    help = 'Migrate per-project job metadata to master database'

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
            treeherder_c = connection.cursor()

            signature_id_map = {}
            min_job_id = 0
            while True:
                job_ids_to_migrate = Job.objects.filter(
                    repository=repository, machine=None,
                    project_specific_id__gt=min_job_id).values_list(
                        'project_specific_id', flat=True).order_by(
                            'project_specific_id')[:1000]
                if not job_ids_to_migrate:
                    # done for this project!
                    break

                c.execute("""select id, signature, job_coalesced_to_guid, build_platform_id, machine_platform_id, machine_id, option_collection_hash, job_type_id, product_id, failure_classification_id, who, reason, result, state, submit_timestamp, start_timestamp, end_timestamp, last_modified, running_eta, tier from job where id in ({})""".format(
                    ','.join([str(job_id) for job_id in job_ids_to_migrate])))
                with transaction.atomic():
                    for (id, signature, job_coalesced_to_guid, build_platform_id, machine_platform_id,
                         machine_id, option_collection_hash, job_type_id, product_id, failure_classification_id,
                         who, reason, result, state, submit_timestamp, start_timestamp, end_timestamp, last_modified,
                         running_eta, tier) in c.fetchall():
                        signature_id = signature_id_map.get(signature)
                        if not signature_id:
                            try:
                                signature_id = ReferenceDataSignatures.objects.values_list('id', flat=True).get(
                                    repository=repository.name, signature=signature)
                            except ReferenceDataSignatures.DoesNotExist:
                                print "WARNING: non-existing refdata signature: {}".format(signature)
                                continue
                            signature_id_map[signature] = signature_id
                        treeherder_c.execute('''
                        update job set
                        signature_id=%s,
                        coalesced_to_guid=%s,
                        build_platform_id=%s,
                        machine_platform_id=%s,
                        machine_id=%s,
                        option_collection_hash=%s,
                        job_type_id=%s,
                        product_id=%s,
                        failure_classification_id=%s,
                        who=%s,
                        reason=%s,
                        result=%s,
                        state=%s,
                        submit_time=%s,
                        start_time=%s,
                        end_time=%s,
                        last_modified=%s,
                        running_eta=%s,
                        tier=%s
                        where repository_id=%s and project_specific_id=%s
                        ''', [
                            signature_id,
                            job_coalesced_to_guid,
                            build_platform_id,
                            machine_platform_id,
                            machine_id,
                            option_collection_hash,
                            job_type_id,
                            product_id,
                            failure_classification_id,
                            who,
                            reason,
                            result,
                            state,
                            datetime.datetime.fromtimestamp(
                                submit_timestamp),
                            datetime.datetime.fromtimestamp(
                                start_timestamp),
                            datetime.datetime.fromtimestamp(
                                end_timestamp),
                            last_modified,
                            running_eta,
                            tier,
                            repository.id,
                            id])
                    print '.',
                    min_job_id = job_ids_to_migrate[len(job_ids_to_migrate) - 1]
            treeherder_c.close()
