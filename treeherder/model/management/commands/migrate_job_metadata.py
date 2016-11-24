import datetime

import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand

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

            signature_id_map = {}

            while True:
                job_ids_to_migrate = Job.objects.filter(
                    repository=repository, machine=None).values_list(
                        'id', 'project_specific_id')[:100]
                if not job_ids_to_migrate:
                    # done for this project!
                    break
                project_specific_ids = [str(job_id_pair[1]) for job_id_pair in job_ids_to_migrate]
                c.execute("""select id, signature, job_coalesced_to_guid, build_platform_id, machine_platform_id, machine_id, option_collection_hash, job_type_id, product_id, failure_classification_id, who, reason, result, state, submit_timestamp, start_timestamp, end_timestamp, last_modified, running_eta, tier from job where id in ({})""".format(
                    ','.join(project_specific_ids)))
                for (id, signature, job_coalesced_to_guid, build_platform_id, machine_platform_id,
                     machine_id, option_collection_hash, job_type_id, product_id, failure_classification_id,
                     who, reason, result, state, submit_timestamp, start_timestamp, end_timestamp, last_modified,
                     running_eta, tier) in c.fetchall():
                    print signature, option_collection_hash
                    signature_id = signature_id_map.get(signature)
                    if not signature_id:
                        try:
                            signature_id = ReferenceDataSignatures.objects.values_list('id', flat=True).get(
                                repository=repository.name, signature=signature)
                        except ReferenceDataSignatures.DoesNotExist:
                            print "WARNING: non-existing refdata signature: {}".format(signature)
                            continue
                        signature_id_map[signature] = signature_id
                    Job.objects.filter(
                        repository=repository, project_specific_id=id).update(
                            signature_id=signature_id,
                            coalesced_to_guid=job_coalesced_to_guid,
                            build_platform_id=build_platform_id,
                            machine_platform_id=machine_platform_id,
                            machine_id=machine_id,
                            option_collection_hash=option_collection_hash,
                            job_type_id=job_type_id,
                            product_id=product_id,
                            failure_classification_id=failure_classification_id,
                            who=who, reason=reason, result=result, state=state,
                            submit_time=datetime.datetime.fromtimestamp(
                                submit_timestamp),
                            start_time=datetime.datetime.fromtimestamp(
                                start_timestamp),
                            end_time=datetime.datetime.fromtimestamp(
                                end_timestamp),
                            last_modified=last_modified,
                            running_eta=running_eta,
                            tier=tier)
                print '.',
