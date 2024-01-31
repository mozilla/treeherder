from abc import ABC, abstractmethod
from copy import deepcopy
from datetime import timedelta, datetime
from typing import Tuple, List

import requests
from django.conf import settings
from requests import Session

from treeherder.config.settings import BZ_DATETIME_FORMAT
from treeherder.perf.exceptions import NoFiledBugs, BugzillaEndpointError
from treeherder.perf.models import PerformanceAlert

# Google Doc specification
PERF_SHERIFFING_CRITERIA = (
    "https://docs.google.com/document/d/11WPIPFeq-i1IAVOQhBR-SzIMOPSqBVjLepgOWCrz_S4"
)
ENGINEER_TRACTION_SPECIFICATION = f"{PERF_SHERIFFING_CRITERIA}#heading=h.8th4thm4twvx"
FIX_RATIO_SPECIFICATION = f"{PERF_SHERIFFING_CRITERIA}#heading=h.8sevd69iqfz9"


class NonBlockableSession(Session):
    def __init__(self, referer=None):
        super().__init__()
        referer = referer or PERF_SHERIFFING_CRITERIA

        # Use a custom HTTP adapter, so we can set a non-zero max_retries value.
        self.mount("https://", requests.adapters.HTTPAdapter(max_retries=3))

        # Add `Referer` & `User-Agent` header, so Bugzilla OPS
        # will be more likely to contact us before blocking our
        # IP when making many queries with this
        self.headers = {
            "Referer": f"{referer}",
            "User-Agent": "treeherder/{}".format(settings.SITE_HOSTNAME),
            "Accept": "application/json",
        }


class BugzillaFormula(ABC):
    """
    Template Method base class
    """

    def __init__(
        self,
        session: NonBlockableSession = None,
        quantifying_period: timedelta = None,
        bug_cooldown: timedelta = None,
    ):
        self._session = session or self._create_default_session()
        self._quant_period = quantifying_period or settings.QUANTIFYING_PERIOD
        self._bug_cooldown = bug_cooldown or settings.BUG_COOLDOWN_TIME
        self._bugzilla_url = settings.BZ_API_URL

        if not isinstance(self._session, NonBlockableSession):
            raise TypeError(
                "Engineer traction formula should only query using an non blockable HTTP session"
            )  # otherwise Bugzilla OPS will block us by IP

        # for breakdown
        self._denominator_bugs = None
        self._numerator_bugs = None

    @property
    def quantifying_period(self):
        return self._quant_period

    @property
    def oldest_timestamp(self):
        return datetime.now() - self._quant_period

    def __call__(self, framework: str, suite: str, test: str = None) -> float:
        self.__reset_breakdown()
        if None in (framework, suite):
            raise TypeError
        test = test or None  # '' and None are the same thing

        all_filed_bugs = self.__fetch_cooled_down_bugs(framework, suite, test)
        if len(all_filed_bugs) == 0:
            raise NoFiledBugs()

        denominator_bugs = self._filter_denominator_bugs(all_filed_bugs)
        numerator_bugs = self._filter_numerator_bugs(all_filed_bugs)

        result = len(numerator_bugs) / len(denominator_bugs)

        # cache the breakdown
        self._denominator_bugs = denominator_bugs
        self._numerator_bugs = numerator_bugs

        return result

    def breakdown(self) -> Tuple[list, list]:
        breakdown_items = (self._denominator_bugs, self._numerator_bugs)
        if None in breakdown_items:
            raise RuntimeError("Cannot breakdown results without running calculus first")

        return tuple(deepcopy(item) for item in breakdown_items)

    def has_cooled_down(self, bug: dict) -> bool:
        try:
            creation_time = self.__get_datetime(bug["creation_time"])
        except (KeyError, ValueError) as ex:
            raise ValueError("Bug has unexpected JSON body") from ex
        else:
            return creation_time <= datetime.now() - self._bug_cooldown

    @abstractmethod
    def _filter_numerator_bugs(self, all_filed_bugs: List[dict]) -> List[dict]:
        pass

    @abstractmethod
    def _filter_denominator_bugs(self, all_filed_bugs: List[dict]) -> List[dict]:
        pass

    def _create_default_session(self) -> NonBlockableSession:
        """
        Template Method hook
        """
        return NonBlockableSession()

    def __fetch_cooled_down_bugs(self, framework: str, suite: str, test: str = None) -> List[dict]:
        quantified_bugs = self.__fetch_quantified_bugs(framework, suite, test)
        cooled_bugs = self.__filter_cooled_down_bugs(quantified_bugs)
        return cooled_bugs

    def __fetch_quantified_bugs(self, framework: str, suite: str, test: str = None) -> List[dict]:
        test_moniker = " ".join(filter(None, (suite, test)))
        test_id_fragments = filter(None, [framework, test_moniker])
        creation_time = datetime.strftime(self.oldest_timestamp, BZ_DATETIME_FORMAT)

        params = {
            "longdesc": ",".join(test_id_fragments),
            "longdesc_type": "allwordssubstr",
            "longdesc_initial": 1,
            "keywords": "perf,perf-alert",
            "keywords_type": "anywords",
            "creation_time": creation_time,
            "query_format": "advanced",
            "include_fields": "id,type,resolution,last_change_time,is_open,creation_time,summary,whiteboard,status,keywords",
        }

        try:
            bugs_resp = self._session.get(
                f"{self._bugzilla_url}/rest/bug",
                headers={"Accept": "application/json"},
                params=params,
                timeout=90,  # query is demanding; give it a bit more patience
            )
        except Exception as ex:
            raise BugzillaEndpointError from ex
        else:
            return bugs_resp.json()["bugs"]

    def __filter_cooled_down_bugs(self, bugs: List[dict]) -> List[dict]:
        return [bug for bug in bugs if self.has_cooled_down(bug)]

    def __reset_breakdown(self):
        self._denominator_bugs = None
        self._numerator_bugs = None

    def __get_datetime(self, datetime_: str) -> datetime:
        return datetime.strptime(datetime_, BZ_DATETIME_FORMAT)


class EngineerTractionFormula(BugzillaFormula):
    def _filter_numerator_bugs(self, cooled_bugs: List[dict]) -> List[dict]:
        tracted_bugs = []
        for bug in cooled_bugs:
            bug_history = self._fetch_history(bug["id"])
            up_to_date = (
                datetime.strptime(bug["creation_time"], BZ_DATETIME_FORMAT) + self._bug_cooldown
            )
            if self._notice_any_status_change_in(bug_history, up_to_date):
                tracted_bugs.append(bug)

        return tracted_bugs

    def _filter_denominator_bugs(self, all_filed_bugs: List[dict]) -> List[dict]:
        return all_filed_bugs

    def _fetch_history(self, bug_id: int) -> list:
        try:
            history_resp = self._session.get(
                f"{self._bugzilla_url}/rest/bug/{bug_id}/history",
                headers={"Accept": "application/json"},
                timeout=60,
            )
        except Exception as ex:
            raise BugzillaEndpointError from ex
        else:
            body = history_resp.json()
            return body["bugs"][0]["history"]

    def _notice_any_status_change_in(self, bug_history: List[dict], up_to: datetime) -> bool:
        def during_interval(change: dict) -> bool:
            when = datetime.strptime(change["when"], BZ_DATETIME_FORMAT)
            return when <= up_to

        # filter changes that occurred during bug cool down
        relevant_changes = [change for change in bug_history if during_interval(change)]

        # return on any changes WRT 'status' or 'resolution'
        for compound_change in relevant_changes:
            for change in compound_change["changes"]:
                if change["field_name"] in {"status", "resolution"}:
                    return True
        return False

    def _create_default_session(self) -> NonBlockableSession:
        return NonBlockableSession(referer=f"{ENGINEER_TRACTION_SPECIFICATION}")


class FixRatioFormula(BugzillaFormula):
    def _filter_numerator_bugs(self, all_filed_bugs: List[dict]) -> List[dict]:
        # select only RESOLVED - FIXED bugs
        return [
            bug
            for bug in all_filed_bugs
            if bug.get("status") == "RESOLVED" and bug.get("resolution") == "FIXED"
        ]

    def _filter_denominator_bugs(self, all_filed_bugs: List[dict]) -> List[dict]:
        # select RESOLVED bugs, no matter what resolution they have
        return [bug for bug in all_filed_bugs if bug.get("status") == "RESOLVED"]

    def _create_default_session(self) -> NonBlockableSession:
        return NonBlockableSession(referer=f"{FIX_RATIO_SPECIFICATION}")


class TotalAlertsFormula:
    MAX_INVESTIGATION_TIME = timedelta(
        weeks=2
    )  # until perf sheriffs should figure out a particular culprit

    def __init__(
        self,
        quantifying_period: timedelta = None,
    ):
        self._quant_period = quantifying_period or settings.QUANTIFYING_PERIOD

    @property
    def quantifying_period(self):
        return self._quant_period

    @property
    def oldest_timestamp(self):
        return datetime.now() - (self._quant_period + self.MAX_INVESTIGATION_TIME)

    def __call__(self, framework: str, suite: str, test: str = None) -> int:
        filters = {"series_signature__framework__name": framework, "series_signature__suite": suite}
        if test is not None:
            filters["series_signature__test"] = test

        return (
            PerformanceAlert.objects.select_related(
                "series_signature", "series_signature__framework"
            )
            .filter(**filters, last_updated__gte=self.oldest_timestamp)
            .count()
        )
