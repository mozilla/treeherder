import datetime
import json
import logging
import os

from treeherder.seta.models import JobPriority

LOG = logging.getLogger(__name__)
THE_FUTURE = datetime.datetime(2100, 12, 31)


def load_preseed():
    """ Update JobPriority information from preseed.json

    We currently call this method on a schedule. See treeherder/seta/tasks.py for details.

    The preseed data has these fields: buildtype, testtype, platform, priority, timeout, expiration_date
    The expiration_date field defaults to 2 weeks when inserted in the table
    The expiration_date field has the format "YYYY-MM-DD", however, it can have "*" to indicate to never expire
    The default priority is 1, however, if we want to force coalescing we can do that
    The fields buildtype, testtype and platform can have * which makes ut match  all flavors of
    the * field. For example: (linux64, pgo, *) matches all Linux 64 pgo tests
    """
    preseed = preseed_data()
    for job in preseed:
        queryset = JobPriority.objects.all()

        for field in ('testtype', 'buildtype', 'platform'):
            if job[field] != '*':
                queryset = queryset.filter(**{field: job[field]})

        # Deal with the case where we have a new entry in preseed
        if len(queryset) == 0:
            create_new_entry(job)
        else:
            # We can have wildcards, so loop on all returned values in data
            for jp in queryset:
                process_job_priority(jp, job)


def preseed_data():
    with open(os.path.join(os.path.dirname(__file__), 'preseed.json'), 'r') as fd:
        preseed = json.load(fd)

    return preseed


def create_new_entry(job):
    if job['expiration_date'] == '*':
        job['expiration_date'] = THE_FUTURE

    LOG.info("Adding a new job to the database: %s" % job)
    JobPriority.objects.create(
            testtype=job['testtype'],
            buildtype=job['buildtype'],
            platform=job['platform'],
            priority=job['priority'],
            timeout=job['timeout'],
            expiration_date=job['expiration_date'],
            buildsystem=job['buildsystem']
    )


def process_job_priority(jp, job):
    update_fields = []
    # Updating the buildtype can be dangerous as analyze_failures can set it to '*' while in here
    # we can change it back to 'taskcluster'. For now, we will assume that creating a new entry
    # will add the right value at the beginning
    for field in ('priority', 'timeout'):
        if jp.__getattribute__(field) != job[field]:
            jp.__setattr__(field, job[field])
            update_fields.append(field)

    if job['expiration_date'] == '*' and jp.expiration_date != THE_FUTURE:
        jp.expiration_date = THE_FUTURE
        update_fields.append('expiration_date')

    if update_fields:
        LOG.info("Updating ({}) for these fields {}".format(str(jp), ','.join(update_fields)))
        jp.save(update_fields=update_fields)
