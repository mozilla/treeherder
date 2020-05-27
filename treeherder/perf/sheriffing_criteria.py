from copy import deepcopy
from typing import List, Tuple
from django.conf import settings
from requests import Session

from datetime import datetime, timedelta

from treeherder.config.settings import BZ_DATETIME_FORMAT
from treeherder.perf.exceptions import NoFiledBugs, BugzillaEndpointError


class EngineerTractionFormula:
    def __init__(
        self, session: Session, quantifying_period: timedelta = None, bug_cooldown: timedelta = None
    ):
        self._session = session
        self._quant_period = quantifying_period or settings.QUANTIFYING_PERIOD
        self._bug_cooldown = bug_cooldown or settings.BUG_COOLDOWN_TIME
        self._bugzilla_url = settings.BZ_API_URL

        # for breakdown
        self.__all_filed_bugs = None
        self.__except_new_bugs = None

    @property
    def quantifying_period(self):
        return self._quant_period

    @property
    def oldest_timestamp(self):
        return datetime.now() - self._quant_period

    def __call__(self, framework: str, suite: str, test: str = None) -> float:
        self._reset_breakdown()
        if None in (framework, suite):
            raise TypeError

        all_filed_bugs = self._fetch_cooled_down_bugs(framework, suite, test)
        except_new_bugs = self._filter_tracted_bugs(all_filed_bugs)

        if len(all_filed_bugs) == 0:
            raise NoFiledBugs()

        result = len(except_new_bugs) / len(all_filed_bugs)

        # cache the breakdown
        self.__all_filed_bugs = all_filed_bugs
        self.__except_new_bugs = except_new_bugs

        return result

    def breakdown(self) -> Tuple[list, list]:
        breakdown_items = (self.__all_filed_bugs, self.__except_new_bugs)
        if not all(breakdown_items):
            raise RuntimeError('Cannot breakdown results without running calculus first')

        return tuple(deepcopy(item) for item in breakdown_items)

    def has_cooled_down(self, bug: dict) -> bool:
        try:
            creation_time = self._get_datetime(bug['creation_time'])
        except (KeyError, ValueError) as ex:
            raise ValueError('Bug has unexpected JSON body') from ex
        else:
            return creation_time <= datetime.now() - self._bug_cooldown

    def _fetch_cooled_down_bugs(self, framework, suite, test):
        quantified_bugs = self._fetch_quantified_bugs(framework, suite, test)
        cooled_bugs = self._filter_cooled_down_bugs(quantified_bugs)
        return cooled_bugs

    def _filter_tracted_bugs(self, cooled_bugs: List[dict]) -> List[dict]:
        tracted_bugs = []
        for bug in cooled_bugs:
            bug_history = self._fetch_history(bug['id'])
            up_to_date = (
                datetime.strptime(bug['creation_time'], BZ_DATETIME_FORMAT) + self._bug_cooldown
            )
            if self._notice_any_status_change_in(bug_history, up_to_date):
                tracted_bugs.append(bug)

        return tracted_bugs

    def _fetch_quantified_bugs(self, framework: str, suite: str, test: str = None) -> List[dict]:
        test_moniker = ' '.join(filter(None, (suite, test)))
        test_id_fragments = filter(None, [framework, test_moniker])
        creation_time = datetime.strftime(self.oldest_timestamp, BZ_DATETIME_FORMAT)

        params = {
            'longdesc': ','.join(test_id_fragments),
            'longdesc_type': 'allwordssubstr',
            'longdesc_initial': 1,
            'keywords': 'perf,perf-alert',
            'keywords_type': 'anywords',
            'creation_time': creation_time,
            'query_format': 'advanced',
            'include_fields': 'id,type,resolution,last_change_time,is_open,creation_time,summary,whiteboard,status,keywords',
        }

        try:
            bugs_resp = self._session.get(
                f'{self._bugzilla_url}/rest/bug',
                headers={'Accept': 'application/json'},
                params=params,
                timeout=90,  # query is demanding; give it a bit more patience
            )
        except Exception as ex:
            raise BugzillaEndpointError from ex
        else:
            return bugs_resp.json()['bugs']

    def _filter_cooled_down_bugs(self, bugs: list) -> List[dict]:
        return [bug for bug in bugs if self.has_cooled_down(bug)]

    def _fetch_history(self, bug_id: int) -> list:
        try:
            history_resp = self._session.get(
                f'{self._bugzilla_url}/rest/bug/{bug_id}/history',
                headers={'Accept': 'application/json'},
                timeout=60,
            )
        except Exception as ex:
            raise BugzillaEndpointError from ex
        else:
            body = history_resp.json()
            return body['bugs'][0]['history']

    def _notice_any_status_change_in(self, bug_history: List[dict], up_to: datetime) -> bool:
        def during_interval(change: dict) -> bool:
            when = datetime.strptime(change['when'], BZ_DATETIME_FORMAT)
            return when <= up_to

        # filter changes that occurred during bug cool down
        relevant_changes = [change for change in bug_history if during_interval(change)]

        # return on any changes WRT 'status' or 'resolution'
        for compound_change in relevant_changes:
            for change in compound_change['changes']:
                if change['field_name'] in {'status', 'resolution'}:
                    return True
        return False

    def _reset_breakdown(self):
        self.__all_filed_bugs = None
        self.__except_new_bugs = None

    def _get_datetime(self, datetime_: str) -> datetime:
        return datetime.strptime(datetime_, BZ_DATETIME_FORMAT)
