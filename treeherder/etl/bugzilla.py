from urllib import urlencode
import datetime

from django.conf import settings
from django.core.cache import cache

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.model.derived import RefDataManager


class BzApiBugProcess(JsonExtractorMixin):

    def _get_bz_source_url(self, last_fetched=None):
        hostname = settings.BZ_API_URL
        params = {
            'keywords': 'intermittent-failure',
            'include_fields': 'id,summary,status,resolution,op_sys,cf_crash_signature, keywords',
        }
        if last_fetched:
            params.update({'changed_after': last_fetched})
        endpoint = 'rest/bug'

        source_url = '{0}/{1}?{2}'.format(
            hostname, endpoint, urlencode(params)
        )
        return source_url

    def run(self):
        # this is the last day we fetched bugs from bugzilla
        last_fetched = cache.get('bz_last_fetched')
        curr_date = datetime.date.today()

        bug_list = []

        if last_fetched:
            # if we have a last_fetched timestamp available
            # we don't need pagination.
            source_url = self._get_bz_source_url(last_fetched)
            response = self.extract(source_url)
            if response:
                bug_list = response.get('bugs', [])
        else:
            offset = 0
            limit = 500

            # fetch new pages no more than 30 times
            # this is a safe guard to not generate an infinite loop
            # in case something went wrong
            for i in range(1, 30+1):
                # fetch the bugzilla service until we have an empty result
                paginated_url = "{0}&offset={1}&limit={2}".format(
                    self._get_bz_source_url(),
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

            # store the new date for one day
            cache.set('bz_last_fetched', curr_date, 60 * 60 * 24)

            rdm = RefDataManager()
            try:
                rdm.update_bugscache(bug_list)
            finally:
                rdm.disconnect()
