import logging
from copy import deepcopy
from datetime import datetime, timezone

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class BugSearcher:
    """Helper class to perform queries on Bugzilla.

    TODO: Replace this with libmozdata Bugzilla class (potentially
    replacing BugManager too)
    """

    def __init__(self):
        self.bz_url = settings.BUGFILER_API_URL + "/rest/bug"
        self.bz_headers = {}
        self._include_fields = ["id"]
        self._products = []
        self._query = {}

    def set_include_fields(self, include_fields):
        """Set the fields that should be included in the returned result.

        By default, only the bug ID is returned. Some example fields are:
            * history
            * resolution
            * status

        Have a look at bugbot rules for more examples: https://github.com/mozilla/bugbot
        """
        self._include_fields = include_fields

    def set_products(self, products):
        """Set the products to get bugs from.

        By default, bugs come from all products.
        """
        self._products = products

    def set_query(self, query):
        """Set the query for the bug search.

        There is no default setting, and this query must be specified.
        Have a look at bugbot rules for examples: https://github.com/mozilla/bugbot

        It's good practice to have a time range specified on the query.
        """
        self._query = query

    def get_today_date(self):
        """Helper method to get today's date in the YYYY-MM-DD format."""
        return datetime.now(timezone.utc).date()

    def _find_last_filter_num(self):
        """Used to find the last filter number used."""
        filter_num = 0
        for filter_field in self._query:
            if len(filter_field) == 2 and filter_field.startswith("f"):
                filter_num = max(filter_num, int(filter_field[1]))
        return filter_num

    def _build_bugzilla_params(self):
        """Builds the params for the bugzilla query."""
        params = deepcopy(self._query)

        if self._products:
            filter_num = self._find_last_filter_num()
            params.update(
                {
                    f"f{filter_num}": "product",
                    f"o{filter_num}": "anywordssubstr",
                    f"v{filter_num}": ",".join(self._products),
                }
            )

        if not params.get("include_fields"):
            params["include_fields"] = self._include_fields

        return params

    def get_bugs(self):
        """Gets all the bugs using the specified query settings."""
        if not self._query:
            logger.warning("Cannot perform bug query as no query was defined.")
            return

        headers = deepcopy(self.bz_headers)
        headers["User-Agent"] = f"treeherder/{settings.SITE_HOSTNAME}"

        params = self._build_bugzilla_params()

        resp = requests.get(
            url=self.bz_url,
            params=params,
            headers=headers,
            verify=True,
            timeout=30,
        )
        resp.raise_for_status()

        return resp.json()
