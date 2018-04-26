import os
import re
import shutil
import subprocess

from django.core.management import call_command
from django.core.management.base import BaseCommand

from treeherder.model.models import (BugJobMap,
                                     BuildPlatform,
                                     FailureClassification,
                                     FailureLine,
                                     Job,
                                     JobGroup,
                                     JobType,
                                     Machine,
                                     MachinePlatform,
                                     Product,
                                     Push,
                                     ReferenceDataSignatures,
                                     Repository,
                                     RepositoryGroup,
                                     TextLogError,
                                     TextLogStep)

first_cap_re = re.compile('(.)([A-Z][a-z]+)')
all_cap_re = re.compile('([a-z0-9])([A-Z])')

DUMP_DIR = 'dumps'


def convert(name):
    s1 = first_cap_re.sub(r'\1_\2', name)
    return all_cap_re.sub(r'\1_\2', s1).lower()


def dump(qs):
    model = qs.model.__name__
    model_path = 'model.{}'.format(model)
    json_path = '{}/{}.json'.format(DUMP_DIR, convert(model))

    ids = [str(pk) for pk in qs.values_list('id', flat=True)]

    call_command(
        'dumpdata',
        model_path,
        pks=','.join(ids),
        output=json_path,
        indent=2,
    )
    print('Dumped {} {}s'.format(len(ids), model))

    return json_path


def dump_all(model):
    return dump(model.objects.all())


def nullify(field, filename):
    subprocess.check_call(
        r"sed -i -E 's/(\"{}\": )[0-9]+/\1null/' {}".format(field, filename),
        shell=True,
    )


class Command(BaseCommand):
    help = 'Dump the given number of classified failures to JSON'

    def add_arguments(self, parser):
        parser.add_argument('limit', type=int, help='How many recent classifications to get')

    def handle(self, *args, **options):
        # CLEAR DUMPS
        shutil.rmtree(DUMP_DIR, ignore_errors=True)
        os.mkdir(DUMP_DIR)

        # get last LIMIT BugJobMaps
        limit = options['limit']
        recent_maps = BugJobMap.objects.order_by('-created').only('job_id')[:limit]
        recent_map_ids = [bug_job_map.job_id for bug_job_map in recent_maps]
        print('Found {} recent Bug Job Mappings'.format(len(recent_map_ids)))

        dump_all(BuildPlatform)
        dump_all(FailureClassification)
        dump_all(JobGroup)
        dump_all(JobType)
        dump_all(MachinePlatform)
        dump_all(Product)
        dump_all(Repository)
        dump_all(RepositoryGroup)

        # JOBS
        jobs = Job.objects.filter(id__in=recent_map_ids).only(
            'guid',
            'id',
            'machine_id',
            'push_id',
            'signature_id',
        )
        job_guids = [j.guid for j in jobs]
        job_ids = [str(j.id) for j in jobs]
        machine_ids = [str(j.machine_id) for j in jobs]
        push_ids = [str(j.push_id) for j in jobs]
        sig_ids = [str(j.signature_id) for j in jobs]
        dump(jobs)

        # MACHINES
        dump(Machine.objects.filter(id__in=machine_ids))
        dump(Push.objects.filter(id__in=push_ids))
        dump(ReferenceDataSignatures.objects.filter(id__in=sig_ids))

        # JOB STEPS
        steps = TextLogStep.objects.filter(job_id__in=job_ids).only('id')
        step_ids = [str(s.id) for s in steps]
        dump(steps)

        # FAILURE LINES
        json_path = dump(FailureLine.objects.filter(job_guid__in=job_guids))
        nullify('best_classification', json_path)
        nullify('job_log', json_path)

        # TEXT LOG ERRORS
        dump(TextLogError.objects.filter(step__in=step_ids))
