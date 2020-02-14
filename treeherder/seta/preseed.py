import datetime
import json
import logging
import os

from treeherder.etl.seta import (get_reference_data_names,
                                 transform)
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import SETA_LOW_VALUE_PRIORITY

THE_FUTURE = datetime.datetime(2100, 12, 31)

logger = logging.getLogger(__name__)


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

    assert len(potential_matches) > 0, \
        Exception("%s is not valid. Please check runnable_jobs.json from a Gecko decision task.", entry["testtype"])

    # XXX: Same transformation as in treeherder.etl.seta.parse_testtype
    unique_identifier = (
        transform(entry["testtype"]).split('-{buildtype}'.format(buildtype=entry["buildtype"]))[-1],
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
    """ Update JobPriority information from preseed.json

    The preseed data has these fields: buildtype, testtype, platform, priority, expiration_date
    The expiration_date field defaults to 2 weeks when inserted in the table
    The expiration_date field has the format "YYYY-MM-DD", however, it can have "*" to indicate to never expire
    The default priority is 1, however, if we want to force coalescing we can do that
    The fields buildtype, testtype and platform can have * which makes ut match  all flavors of
    the * field. For example: (linux64, pgo, *) matches all Linux 64 pgo tests
    """
    logger.info("About to load preseed.json")
    if not JobPriority.objects.exists():
        logger.warning("There's no JobPriority objects in the table. Call first ./manage.py initialize_seta")
        return

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
                queryset = queryset.filter(**{field: job[field]})

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
    JobPriority.objects.create(
        testtype=job['testtype'],
        buildtype=job['buildtype'],
        platform=job['platform'],
        priority=job['priority'],
        expiration_date=job['expiration_date'],
        buildsystem=job['buildsystem']
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
