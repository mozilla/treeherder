from urllib import urlencode

from django.conf import settings

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.model.derived import RefDataManager


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
            for bug in bug_list:
                # drop the timezone indicator to avoid issues with mysql
                bug["last_change_time"] = bug["last_change_time"][0:19]

            with RefDataManager() as rdm:
                rdm.update_bugscache(bug_list)
