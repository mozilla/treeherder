import collections
import logging
from hashlib import sha1
import datetime

from django.conf import settings

from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.etl.common import fetch_json
from treeherder.model.models import (BuildPlatform,
                                     JobGroup,
                                     JobType,
                                     MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Repository,
                                     RunnableJob)

logger = logging.getLogger(__name__)


class AllthethingsTransformerMixin:

    def transform(self, extracted_content):
        logger.info('About to import allthethings.json builder data.')

        jobs_per_branch = collections.defaultdict(list)

        for builder, content in extracted_content['builders'].iteritems():
            job = get_symbols_and_platforms(builder)

            branch = content['properties']['branch']
            job.update({'branch': branch})
            jobs_per_branch[branch].append(job)

        return jobs_per_branch


class RunnableJobsProcess(AllthethingsTransformerMixin):

    # XXX: Copied from refdata.py. What is the best place for this?
    def get_option_collection_hash(self, options):
        """returns an option_collection_hash given a list of options"""

        options = sorted(list(options))
        sha_hash = sha1()
        # equivalent to loop over the options and call sha_hash.update()
        sha_hash.update(''.join(options))
        return sha_hash.hexdigest()

    def load(self, jobs_per_branch):
        active_repositories = Repository.objects.all().filter(
            active_status='active')

        now = datetime.datetime.now()
        for repo in active_repositories:
            # Some active repositories might not have any buildbot
            # builders.
            if repo.name not in jobs_per_branch:
                continue

            for datum in jobs_per_branch[repo.name]:
                # XXX: refdata.py truncates those fields at 25 characters.
                # Should we do the same?
                build_platform, _ = BuildPlatform.objects.get_or_create(
                    os_name=datum['build_os'],
                    platform=datum['build_platform'],
                    architecture=datum['build_architecture']
                )

                machine_platform, _ = MachinePlatform.objects.get_or_create(
                    os_name=datum['machine_platform_os'],
                    platform=datum['platform'],
                    architecture=datum['machine_platform_architecture']
                )

                job_group, _ = JobGroup.objects.get_or_create(
                    name=datum['job_group_name'],
                    symbol=datum['job_group_symbol']
                )

                job_type, _ = JobType.objects.get_or_create(
                    name=datum['job_type_name'],
                    symbol=datum['job_type_symbol'],
                    defaults={'job_group': job_group}
                )

                option_collection_hash = self.get_option_collection_hash(
                    datum['option_collection'].keys())

                for key in datum['option_collection'].keys():
                    option, _ = Option.objects.get_or_create(name=key)
                    OptionCollection.objects.get_or_create(
                        option_collection_hash=option_collection_hash,
                        option=option)

                # This automatically updates the last_touched field.
                RunnableJob.objects.update_or_create(
                    ref_data_name=datum['ref_data_name'],
                    build_system_type=datum['build_system_type'],
                    defaults={'build_platform': build_platform,
                              'machine_platform': machine_platform,
                              'job_type': job_type,
                              'option_collection_hash': option_collection_hash,
                              'repository': repo})

        # prune any buildernames that were not just touched/created
        RunnableJob.objects.delete(last_touched__lte=now)

    def run(self):
        all_the_things = fetch_json(settings.ALLTHETHINGS_URL)
        jobs_per_branch = self.transform(all_the_things)
        self.load(jobs_per_branch)
