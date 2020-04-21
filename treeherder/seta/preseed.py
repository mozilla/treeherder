import json
import logging
import os

from treeherder.etl.seta import get_reference_data_names
from treeherder.seta.common import convert_job_type_name_to_testtype
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import SETA_LOW_VALUE_PRIORITY, THE_FUTURE

logger = logging.getLogger(__name__)

'''preseed.json entries have fields: buildtype, testtype, platform,
priority, expiration_date. They must match the corresponding entry in
runnable-jobs.json.

buildtype should match the attribute name in the runnable jobs collection.

testtype should match the full task label.

platform should match the platform.

priority can be 1 to signify high value tasks or 5 to signify low
value tasks. The default priority is 1.

expiration_date must be "*" to signify no expiration.

buildsystem should always be "taskcluster".

Example:

runnable-jobs.json:
"build-android-x86_64-asan-fuzzing/opt": {
  "collection": {
    "asan": true
  },
  "platform": "android-5-0-x86_64",
  "symbol": "Bof"
},
entry in preseed.json
{
  "buildtype": "asan",
  "testtype":  "build-android-x86_64-asan-fuzzing/opt",
  "platform":  "android-5-0-x86_64",
  "priority":  5,
  "expiration_date": "*",
  "buildsytem": "taskcluster"
}
'''


def validate_preseed_entry(entry, ref_names):
    assert entry["testtype"] != "*"
    assert entry["buildtype"] != "*"
    assert entry["platform"] != "*"
    # We also support *, however, that was only useful with Buildbot
    assert entry["buildsystem"] == "taskcluster"
    # We support values different than *, however, it is not useful for preseed
    assert entry["expiration_date"] == "*"
    assert 1 <= entry["priority"] <= SETA_LOW_VALUE_PRIORITY

    # Collect potential matches
    potential_matches = []
    for unique_identifier, ref_name in ref_names.items():
        # XXX: Now that we have fuzzy build the term testtypes is not accurate
        if ref_name == entry["testtype"]:
            potential_matches.append(unique_identifier)

    assert len(potential_matches) > 0, Exception(
        "%s is not valid. Please check runnable_jobs.json from a Gecko decision task.",
        entry["testtype"],
    )

    testtype = convert_job_type_name_to_testtype(entry["testtype"])
    if not testtype:
        logger.warning(
            "Preseed.json entry testtype %s is not a valid task name:", entry["testtype"]
        )
        raise Exception("preseed.json entry contains invalid testtype. Please check output above.")

    unique_identifier = (
        testtype,
        entry["buildtype"],
        entry["platform"],
    )

    try:
        ref_names[unique_identifier]
    except KeyError:
        logger.warning("Preseed.json entry %s matches the following:", unique_identifier)
        logger.warning(potential_matches)
        raise Exception("We failed to match your preseed.json entry. Please check output above.")


def load_preseed(validate=False):
    """ Update JobPriority information from preseed.json"""
    logger.info("About to load preseed.json")

    preseed = preseed_data()
    if validate:
        logger.info("We are going to validate the values from preseed.json")
        ref_names = get_reference_data_names()
    for job in preseed:
        if validate:
            validate_preseed_entry(job, ref_names)

        logger.debug("Processing %s", (job["testtype"], job["buildtype"], job["platform"]))
        queryset = JobPriority.objects.all()

        for field in ('testtype', 'buildtype', 'platform'):
            if job[field] != '*':
                # The JobPriority table does not contain the raw
                # testtype value seen in the preseed.json file. We
                # must convert the job[field] value to the appropriate
                # value before performing the query.
                field_value = (
                    convert_job_type_name_to_testtype(job[field])
                    if field == 'testtype'
                    else job[field]
                )
                queryset = queryset.filter(**{field: field_value})

        # Deal with the case where we have a new entry in preseed
        if not queryset:
            create_new_entry(job)
        else:
            # We can have wildcards, so loop on all returned values in data
            for jp in queryset:
                process_job_priority(jp, job)
    logger.debug("Finished")


def preseed_data():
    with open(os.path.join(os.path.dirname(__file__), 'preseed.json'), 'r') as fd:
        preseed = json.load(fd)

    return preseed


def create_new_entry(job):
    if job['expiration_date'] == '*':
        job['expiration_date'] = THE_FUTURE

    logger.info("Adding a new job priority to the database: %s", job)

    testtype = convert_job_type_name_to_testtype(job['testtype'])

    JobPriority.objects.create(
        testtype=testtype,
        buildtype=job['buildtype'],
        platform=job['platform'],
        priority=job['priority'],
        expiration_date=job['expiration_date'],
        buildsystem=job['buildsystem'],
    )


def process_job_priority(jp, job):
    update_fields = []
    # Updating the buildtype can be dangerous as analyze_failures can set it to '*' while in here
    # we can change it back to 'taskcluster'. For now, we will assume that creating a new entry
    # will add the right value at the beginning
    if jp.__getattribute__('priority') != job['priority']:
        jp.__setattr__('priority', job['priority'])
        update_fields.append('priority')

    if job['expiration_date'] == '*' and jp.expiration_date != THE_FUTURE:
        jp.expiration_date = THE_FUTURE
        update_fields.append('expiration_date')

    if update_fields:
        logger.info("Updating (%s) for these fields %s", jp, ','.join(update_fields))
        jp.save(update_fields=update_fields)
