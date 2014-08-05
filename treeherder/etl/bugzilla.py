from urllib import urlencode

from django.conf import settings

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.model.derived import RefDataManager


def get_bz_source_url():
    hostname = settings.BZ_API_URL
    params = {
        'keywords': 'intermittent-failure',
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

        # fetch new pages no more than 30 times
        # this is a safe guard to not generate an infinite loop
        # in case something went wrong
        for i in range(1, 30+1):
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
            else:
                offset += limit

        if bug_list:
            rdm = RefDataManager()
            try:
                rdm.update_bugscache(bug_list)
            finally:
                rdm.disconnect()
