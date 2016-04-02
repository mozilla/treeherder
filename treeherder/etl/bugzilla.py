from urllib import urlencode

import dateutil.parser
from django.conf import settings

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.model.models import Bugscache


def get_bz_source_url():
    hostname = settings.BZ_API_URL
    params = {
        'keywords': 'intermittent-failure',
        'chfieldfrom': '-1y',
        'include_fields': ('id,summary,status,resolution,'
                           'op_sys,cf_crash_signature, '
                           'keywords, last_change_time')
    }
    endpoint = 'rest/bug'

    source_url = '{0}/{1}?{2}'.format(
        hostname, endpoint, urlencode(params)
    )
    return source_url


class BzApiBugProcess(JsonExtractorMixin):

    def run(self):
        # this is the last day we fetched bugs from bugzilla

        bug_list = []

        offset = 0
        limit = 500

        while True:
            # fetch the bugzilla service until we have an empty result
            paginated_url = "{0}&offset={1}&limit={2}".format(
                get_bz_source_url(),
                offset,
                limit
            )
            response = self.extract(paginated_url)
            temp_bug_list = response.get('bugs', [])
            bug_list += temp_bug_list
            if len(temp_bug_list) < limit:
                break
            offset += limit

        if bug_list:
            bugs_stored = set(Bugscache.objects.values_list('id', flat=True))
            old_bugs = bugs_stored.difference(set(bug['id']
                                                  for bug in bug_list))
            Bugscache.objects.filter(id__in=old_bugs).delete()

            for bug in bug_list:
                Bugscache.objects.update_or_create(
                    id=bug['id'],
                    defaults={
                        'status': bug.get('status', ''),
                        'resolution': bug.get('resolution', ''),
                        'summary': bug.get('summary', ''),
                        'crash_signature': bug.get('cf_crash_signature', ''),
                        'keywords': ",".join(bug['keywords']),
                        'os': bug.get('op_sys', ''),
                        'modified': dateutil.parser.parse(
                            bug['last_change_time'])
                    })
