import logging

from progress.bar import Bar
from treeherder.model.models import Bugscache as Bcache
from treeherder.model.models import OtherTextLogError as OTLE

logging.basicConfig(filename='postgres.log')
logger = logging.getLogger(__name__)

# This runs the following query for each line in the OtherTextLogError
# SELECT *
#   FROM bugscache
#  WHERE to_tsvector(COALESCE(`bugscache`.`summary`, )) @@ (plainto_tsquery(00:22:58    ERROR - Return code: 1)) = true


def run():
    Bugscache = Bcache.objects.using('pg')
    OtherTextLogError = OTLE.objects.using('pg')

    bar = Bar(
        'Searching',
        max=OtherTextLogError.count(),
        suffix='%(index)s/%(max)s (%(percent)d%%) AVG: %(avg)s ETA: %(eta_td)s',
    )

    for log in bar.iter(OtherTextLogError.iterator()):
        bugs = Bugscache.filter(summary__search=log.line)
        bug_count = bugs.count()

        if bug_count > 0:
            bug_ids = ','.join(str(b.id) for b in bugs)
            logger.info('text_log_error={} bugs={} |--> {}'.format(log.pk, bug_ids, log.line))


if __name__ == '__main__':
    run()
