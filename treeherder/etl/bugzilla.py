from urllib import urlencode
import datetime

from django.conf import settings
from django.core.cache import cache

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.model.derived import RefDataManager


class BzApiBugProcess(JsonExtractorMixin):

    def _get_bz_source_url(self, last_fetched):
        hostname = settings.BZ_API_URL
        params = {
            'keywords': 'intermittent-failure',
            'include_fields': 'id,summary,status,resolution,op_sys,cf_crash_signature, keywords'
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
        source_url = self._get_bz_source_url(last_fetched)

        curr_date = datetime.date.today()

        response = self.extract(source_url)
        bug_list = response.get('bugs', [])

        if bug_list:

            # store the new date for one day
            cache.set('bz_last_fetched', curr_date, 60 * 60 * 24)

            rdm = RefDataManager()
            rdm.update_bugscache(bug_list)
