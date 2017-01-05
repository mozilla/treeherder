import logging
import time
from datetime import datetime
from hashlib import sha1

import newrelic.agent
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction

from treeherder.etl.artifact import (serialize_artifact_json_blobs,
                                     store_job_artifacts)
from treeherder.etl.common import get_guid_root
from treeherder.model.models import (BuildPlatform,
                                     Commit,
                                     Datasource,
                                     ExclusionProfile,
                                     FailureClassification,
                                     Job,
                                     JobDuration,
                                     JobGroup,
                                     JobLog,
                                     JobType,
                                     Machine,
                                     MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Product,
                                     Push,
                                     ReferenceDataSignatures,
                                     Repository)

from .base import TreeherderModelBase

logger = logging.getLogger(__name__)


class JobsModel(TreeherderModelBase):

    """
    Represent a job repository
    """

    LOWER_TIERS = [2, 3]

    @classmethod
    def create(cls, project):
        """
        Create all the datasource tables for this project.

        """

        source = Datasource(project=project)
        source.save()

        return cls(project=project)

    ##################
    #
    # Job schema data methods
    #
    ##################

    def _get_lower_tier_signatures(self):
        # get the lower tier data signatures for this project.
        # if there are none, then just return an empty list
        # this keeps track of them order (2, then 3) so that the latest
        # will have precedence.  If a job signature is in both Tier-2 and
        # Tier-3, then it will end up in Tier-3.
        lower_tier_signatures = []
        for tier_num in self.LOWER_TIERS:
            try:
                signatures = ExclusionProfile.objects.get_signatures_for_project(
                    self.project, "Tier-{}".format(tier_num))
                lower_tier_signatures.append({
                    'tier': tier_num,
                    'signatures': signatures
                })
            except ExclusionProfile.DoesNotExist:
                # no exclusion profile for this tier
                pass

        return lower_tier_signatures

    def store_job_data(self, data):
        """
        Store job data instances into jobs db

        Example:
        [
            {
                "revision": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
                "job": {
                    "job_guid": "d19375ce775f0dc166de01daa5d2e8a73a8e8ebf",
                    "name": "xpcshell",
                    "desc": "foo",
                    "job_symbol": "XP",
                    "group_name": "Shelliness",
                    "group_symbol": "XPC",
                    "product_name": "firefox",
                    "state": "TODO",
                    "result": 0,
                    "reason": "scheduler",
                    "who": "sendchange-unittest",
                    "submit_timestamp": 1365732271,
                    "start_timestamp": "20130411165317",
                    "end_timestamp": "1365733932"
                    "machine": "tst-linux64-ec2-314",
                    "build_platform": {
                        "platform": "Ubuntu VM 12.04",
                        "os_name": "linux",
                        "architecture": "x86_64"
                    },
                    "machine_platform": {
                        "platform": "Ubuntu VM 12.04",
                        "os_name": "linux",
                        "architecture": "x86_64"
                    },
                    "option_collection": {
                        "opt": true
                    },
                    "log_references": [
                        {
                            "url": "http://ftp.mozilla.org/pub/...",
                            "name": "unittest"
                        }
                    ],
                    artifacts:[{
                        type:" json | img | ...",
                        name:"",
                        log_urls:[
                            ]
                        blob:""
                    }],
                },
                "coalesced": []
            },
            ...
        ]

        """
        # Ensure that we have job data to process
        if not data:
            return

        # remove any existing jobs that already have the same state
        data = self._remove_existing_jobs(data)
        if not data:
            return

        coalesced_job_guid_placeholders = []

        lower_tier_signatures = self._get_lower_tier_signatures()

        for datum in data:
            try:
                # TODO: this might be a good place to check the datum against
                # a JSON schema to ensure all the fields are valid.  Then
                # the exception we caught would be much more informative.  That
                # being said, if/when we transition to only using the pulse
                # job consumer, then the data will always be vetted with a
                # JSON schema before we get to this point.
                job = datum['job']
                coalesced = datum.get('coalesced', [])

                # For a time, we need to backward support jobs submited with either a
                # ``revision_hash`` or a ``revision``.  Eventually, we will
                # migrate to ONLY ``revision``.  But initially, we will need
                # to find the revision from the revision_hash.
                rs_fields = ["revision", "revision_hash"]
                if not any([x for x in rs_fields if x in datum]):
                    raise ValueError("Job must have either ``revision`` or ``revision_hash``")
                if datum.get('revision'):
                    push_id = Push.objects.values_list('id', flat=True).get(
                        repository__name=self.project,
                        revision__startswith=datum['revision'])
                else:
                    revision_hash = datum.get('revision_hash')
                    push_id = Push.objects.values_list('id', flat=True).get(
                        repository__name=self.project,
                        revision_hash=revision_hash)
                    newrelic.agent.record_exception(
                        exc=ValueError("job submitted with revision_hash but no revision"),
                        params={
                            "revision_hash": datum["revision_hash"]
                        }
                    )

                # load job
                (job_guid, reference_data_signature) = self._load_job(
                    job, push_id, lower_tier_signatures)

                for coalesced_guid in coalesced:
                    coalesced_job_guid_placeholders.append(
                        # coalesced to guid, coalesced guid
                        [job_guid, coalesced_guid]
                    )
            except Exception as e:
                # we should raise the exception if DEBUG is true, or if
                # running the unit tests.
                if settings.DEBUG or hasattr(settings, "TREEHERDER_TEST_PROJECT"):
                    logger.exception(e)
                    raise

                # make more fields visible in new relic for the job
                # where we encountered the error
                datum.update(datum.get("job", {}))
                newrelic.agent.record_exception(params=datum)

                # skip any jobs that hit errors in these stages.
                continue

        # set the job_coalesced_to_guid column for any coalesced
        # job found
        if coalesced_job_guid_placeholders:
            for (job_guid, coalesced_to_guid) in coalesced_job_guid_placeholders:
                Job.objects.filter(guid=coalesced_to_guid).update(
                    coalesced_to_guid=job_guid)

    def _remove_existing_jobs(self, data):
        """
        Remove jobs from data where we already have them in the same state.

        1. split the incoming jobs into pending, running and complete.
        2. fetch the ``job_guids`` from the db that are in the same state as they
           are in ``data``.
        3. build a new list of jobs in ``new_data`` that are not already in
           the db and pass that back.  It could end up empty at that point.
        """
        new_data = []

        guids = [datum['job']['job_guid'] for datum in data]
        state_map = {
            guid: state for (guid, state) in Job.objects.filter(
                guid__in=guids).values_list('guid', 'state')
        }

        for datum in data:
            job = datum['job']
            if not state_map.get(job['job_guid']):
                new_data.append(datum)
            else:
                # should not transition from running to pending,
                # or completed to any other state
                current_state = state_map[job['job_guid']]
                if current_state == 'completed' or (
                        job['state'] == 'pending' and
                        current_state == 'running'):
                    continue
                new_data.append(datum)

        return new_data

    def _load_job(self, job_datum, push_id, lower_tier_signatures):
        """
        Load a job into the treeherder database

        If the job is a ``retry`` the ``job_guid`` will have a special
        suffix on it.  But the matching ``pending``/``running`` job will not.
        So we append the suffixed ``job_guid`` to ``retry_job_guids``
        so that we can update the job_id_lookup later with the non-suffixed
        ``job_guid`` (root ``job_guid``). Then we can find the right
        ``pending``/``running`` job and update it with this ``retry`` job.
        """
        build_platform, _ = BuildPlatform.objects.get_or_create(
            os_name=job_datum.get('build_platform', {}).get('os_name', 'unknown'),
            platform=job_datum.get('build_platform', {}).get('platform', 'unknown'),
            architecture=job_datum.get('build_platform', {}).get('architecture',
                                                                 'unknown'))

        machine_platform, _ = MachinePlatform.objects.get_or_create(
            os_name=job_datum.get('machine_platform', {}).get('os_name', 'unknown'),
            platform=job_datum.get('machine_platform', {}).get('platform', 'unknown'),
            architecture=job_datum.get('machine_platform', {}).get('architecture',
                                                                   'unknown'))

        option_names = job_datum.get('option_collection', [])
        option_collection_hash = OptionCollection.calculate_hash(
            option_names)
        if not OptionCollection.objects.filter(
                option_collection_hash=option_collection_hash).exists():
            # in the unlikely event that we haven't seen this set of options
            # before, add the appropriate database rows
            options = []
            for option_name in option_names:
                option, _ = Option.objects.get_or_create(name=option_name)
                options.append(option)
            for option in options:
                OptionCollection.objects.create(
                    option_collection_hash=option_collection_hash,
                    option=option)

        machine, _ = Machine.objects.get_or_create(
            name=job_datum.get('machine', 'unknown'))

        # if a job with this symbol and name exists, always
        # use its default group (even if that group is different
        # from that specified)
        job_type, _ = JobType.objects.get_or_create(
            symbol=job_datum.get('job_symbol') or 'unknown',
            name=job_datum.get('name') or 'unknown')
        if job_type.job_group:
            job_group = job_type.job_group
        else:
            job_group, _ = JobGroup.objects.get_or_create(
                name=job_datum.get('group_name') or 'unknown',
                symbol=job_datum.get('group_symbol') or 'unknown')
            job_type.job_group = job_group
            job_type.save(update_fields=['job_group'])

        product_name = job_datum.get('product_name', 'unknown')
        if len(product_name.strip()) == 0:
            product_name = 'unknown'
        product, _ = Product.objects.get_or_create(name=product_name)

        job_guid = job_datum['job_guid']
        job_guid = job_guid[0:50]

        who = job_datum.get('who') or 'unknown'
        who = who[0:50]

        reason = job_datum.get('reason') or 'unknown'
        reason = reason[0:125]

        state = job_datum.get('state') or 'unknown'
        state = state[0:25]

        build_system_type = job_datum.get('build_system_type', 'buildbot')

        reference_data_name = job_datum.get('reference_data_name', None)

        default_failure_classification = FailureClassification.objects.get(
            name='not classified')

        sh = sha1()
        sh.update(''.join(
            map(lambda x: str(x),
                [build_system_type, self.project, build_platform.os_name,
                 build_platform.platform, build_platform.architecture,
                 machine_platform.os_name, machine_platform.platform,
                 machine_platform.architecture,
                 job_group.name, job_group.symbol, job_type.name,
                 job_type.symbol, option_collection_hash,
                 reference_data_name])))
        signature_hash = sh.hexdigest()

        # Should be the buildername in the case of buildbot (if not provided
        # default to using the signature hash)
        if not reference_data_name:
            reference_data_name = signature_hash

        signature, created = ReferenceDataSignatures.objects.get_or_create(
            name=reference_data_name,
            signature=signature_hash,
            build_system_type=build_system_type,
            repository=self.project, defaults={
                'first_submission_timestamp': time.time(),
                'build_os_name': build_platform.os_name,
                'build_platform': build_platform.platform,
                'build_architecture': build_platform.architecture,
                'machine_os_name': machine_platform.os_name,
                'machine_platform': machine_platform.platform,
                'machine_architecture': machine_platform.architecture,
                'job_group_name': job_group.name,
                'job_group_symbol': job_group.symbol,
                'job_type_name': job_type.name,
                'job_type_symbol': job_type.symbol,
                'option_collection_hash': option_collection_hash
            })

        if created:
            # A new ReferenceDataSignature has been added, so we need
            # to reload lower tier exclusions
            lower_tier_signatures = self._get_lower_tier_signatures()

        tier = job_datum.get('tier') or 1
        # job tier signatures override the setting from the job structure
        # Check the signatures list for any supported lower tiers that have
        # an active exclusion profile.

        result = job_datum.get('result', 'unknown')

        # As stated elsewhere, a job will end up in the lowest tier where its
        # signature belongs.  So if a signature is in Tier-2 and Tier-3, it
        # will end up in 3.
        for tier_info in lower_tier_signatures:
            if signature_hash in tier_info["signatures"]:
                tier = tier_info["tier"]

        try:
            duration = JobDuration.objects.values_list(
                'average_duration', flat=True).get(
                    repository__name=self.project, signature=signature_hash)
        except JobDuration.DoesNotExist:
            duration = 0

        repository = Repository.objects.get(name=self.project)
        submit_time = datetime.fromtimestamp(
            self.get_number(job_datum.get('submit_timestamp')))
        start_time = datetime.fromtimestamp(
            self.get_number(job_datum.get('start_timestamp')))
        end_time = datetime.fromtimestamp(
            self.get_number(job_datum.get('end_timestamp')))

        # first, try to create the job with the given guid (if it doesn't
        # exist yet)
        job_guid_root = get_guid_root(job_guid)
        if not Job.objects.filter(guid__in=[job_guid, job_guid_root]).exists():
            # this could theoretically throw an exception if we were processing
            # several updates simultaneously, but that should never happen --
            # and if it does it's better just to error out
            Job.objects.create(
                guid=job_guid,
                repository=repository,
                signature=signature,
                build_platform=build_platform,
                machine_platform=machine_platform,
                machine=machine,
                option_collection_hash=option_collection_hash,
                job_type=job_type,
                product=product,
                failure_classification=default_failure_classification,
                who=who,
                reason=reason,
                result=result,
                state=state,
                tier=tier,
                submit_time=submit_time,
                start_time=start_time,
                end_time=end_time,
                last_modified=datetime.now(),
                running_eta=duration,
                push_id=push_id)

        # if the job was pending, there's nothing more to do here
        # (pending jobs have no artifacts, and we would have just created
        # it)
        if state == 'pending':
            return (job_guid, signature_hash)

        # update job (in the case of a buildbot retrigger, we will
        # get the root object and update that to a retry)
        try:
            job = Job.objects.get(guid=job_guid_root)
        except ObjectDoesNotExist:
            job = Job.objects.get(guid=job_guid)
        Job.objects.filter(id=job.id).update(
            guid=job_guid,
            signature=signature,
            build_platform=build_platform,
            machine_platform=machine_platform,
            machine=machine,
            option_collection_hash=option_collection_hash,
            job_type=job_type,
            product=product,
            failure_classification=default_failure_classification,
            who=who,
            reason=reason,
            result=result,
            state=state,
            tier=tier,
            submit_time=submit_time,
            start_time=start_time,
            end_time=end_time,
            last_modified=datetime.now(),
            running_eta=duration,
            push_id=push_id)

        artifacts = job_datum.get('artifacts', [])

        has_text_log_summary = any(x for x in artifacts
                                   if x['name'] == 'text_log_summary')
        if artifacts:
            artifacts = serialize_artifact_json_blobs(artifacts)

            # need to add job guid to artifacts, since they likely weren't
            # present in the beginning
            for artifact in artifacts:
                if not all(k in artifact for k in ("name", "type", "blob")):
                    raise ValueError(
                        "Artifact missing properties: {}".format(artifact))
                # Ensure every artifact has a ``job_guid`` value.
                # It is legal to submit an artifact that doesn't have a
                # ``job_guid`` value.  But, if missing, it should inherit that
                # value from the job itself.
                if "job_guid" not in artifact:
                    artifact["job_guid"] = job_guid

            store_job_artifacts(artifacts)

        log_refs = job_datum.get('log_references', [])
        if log_refs:

            for log in log_refs:
                name = log.get('name') or 'unknown'
                name = name[0:50]

                url = log.get('url') or 'unknown'
                url = url[0:255]

                # this indicates that a summary artifact was submitted with
                # this job that corresponds to the buildbot_text log url.
                # Therefore, the log does not need parsing.  So we should
                # ensure that it's marked as already parsed.
                if has_text_log_summary and name == 'buildbot_text':
                    parse_status = JobLog.PARSED
                else:
                    parse_status_map = dict([(k, v) for (v, k) in
                                             JobLog.STATUSES])
                    mapped_status = parse_status_map.get(
                        log.get('parse_status'))
                    if mapped_status:
                        parse_status = mapped_status
                    else:
                        parse_status = JobLog.PENDING

                jl, _ = JobLog.objects.get_or_create(
                    job=job, name=name, url=url, defaults={
                        'status': parse_status
                    })

                self._schedule_log_parsing(jl, result)

        return (job_guid, signature_hash)

    def get_number(self, s):
        try:
            return long(s)
        except (ValueError, TypeError):
            return 0

    def _schedule_log_parsing(self, job_log, result):
        """Kick off the initial task that parses the log data.

        log_data is a list of job log objects and the result for that job
        """

        # importing here to avoid an import loop
        from treeherder.log_parser.tasks import parse_job_log

        task_types = {
            "errorsummary_json": ("store_failure_lines", "store_failure_lines"),
            "buildbot_text": ("parse_log", "log_parser"),
            "builds-4h": ("parse_log", "log_parser"),
        }

        # a log can be submitted already parsed.  So only schedule
        # a parsing task if it's ``pending``
        # the submitter is then responsible for submitting the
        # text_log_summary artifact
        if job_log.status != JobLog.PENDING:
            return

        # if this is not a known type of log, abort parse
        if not task_types.get(job_log.name):
            return

        func_name, routing_key = task_types[job_log.name]

        if result != 'success':
            routing_key += '.failures'
        else:
            routing_key += ".normal"

        parse_job_log(func_name, routing_key, job_log)

    def store_result_set_data(self, result_sets):
        """
        Stores "result sets" (legacy nomenclature) as push data in
        the treeherder database

        result_sets = [
            {
             "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80",
             "push_timestamp": 1378293517,
             "author": "some-sheriff@mozilla.com",
             "revisions": [
                {
                    "comment": "Bug 911954 - Add forward declaration of JSScript to TraceLogging.h, r=h4writer",
                    "repository": "test_treeherder",
                    "author": "John Doe <jdoe@mozilla.com>",
                    "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80"
                    },
                ...
                ]
                },
            ...
            ]

        returns = {

            }
        """

        if not result_sets:
            logger.info("No new resultsets to store")
            return {}

        for result_set in result_sets:
            self._store_push(result_set)

    def _store_push(self, result_set):
        repository = Repository.objects.get(name=self.project)
        result_set_revision = result_set.get('revision')
        if not result_set.get('revision'):
            raise ValueError("Result set must have a revision "
                             "associated with it!")
        with transaction.atomic():
            push, _ = Push.objects.update_or_create(
                repository=repository,
                revision=result_set_revision,
                defaults={
                    'revision_hash': result_set.get('revision_hash',
                                                    result_set_revision),
                    'author': result_set['author'],
                    'time': datetime.utcfromtimestamp(
                        result_set['push_timestamp'])
                })
            for revision in result_set['revisions']:
                commit, _ = Commit.objects.update_or_create(
                    push=push,
                    revision=revision['revision'],
                    defaults={
                        'author': revision['author'],
                        'comments': revision['comment']
                    })
