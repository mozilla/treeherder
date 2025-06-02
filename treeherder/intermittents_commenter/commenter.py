import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import requests
from django.conf import settings
from django.db.models import Count
from jinja2 import Template
from requests.exceptions import RequestException

from treeherder.intermittents_commenter.constants import (
    COMPONENTS,
    WHITEBOARD_NEEDSWORK_OWNER,
)
from treeherder.model.models import BugJobMap, OptionCollection

from . import fetch

logger = logging.getLogger(__name__)


@dataclass
class BugsDetailsPerPlatform:
    total: int = 0
    per_build_type: dict[str, int] = field(
        default_factory=dict
    )  # {build_type1: 2, build_type2: 1, ...}


@dataclass
class BugRunInfo:
    platform: str = ""
    arch: str = ""
    os_name: str = ""
    os_version: str = ""
    build_type: str = ""
    current_variant: str = ""
    variants: set[str] = field(default_factory=set)


@dataclass
class BugsDetails:
    run_count: dict[str, int] = field(default_factory=dict)  # {job_name: run_count}
    total: int = 0
    test_variants: set = field(default_factory=set)
    per_repositories: dict[str, int] = field(default_factory=dict)  # {repo1: 1, repo2: 2, ...}
    data_table: dict[str, dict[str, int]] = field(
        default_factory=dict
    )  # {variant1: {platform_and_build1: 3, platform_and_build2: 1}, ...}


class Commenter:
    """Handles fetching, composing and submitting bug comments based on
    daily or weekly thresholds and date range, and updating whiteboard
    and priority status as need; if in dry_run, comments will be output
    to stdout rather than submitting to bugzilla."""

    test_variants = None
    manifests = None
    testrun_matrix = None
    summary_groups = None

    def __init__(self, weekly_mode, dry_run=False):
        self.weekly_mode = weekly_mode
        self.dry_run = dry_run
        self.session = self.new_request()

    def run(self):
        startday, endday = self.calculate_date_strings(self.weekly_mode, 6)
        alt_startday, alt_endday = self.calculate_date_strings(True, 21)
        all_bug_changes = self.generate_bug_changes(startday, endday, alt_startday, alt_endday)
        self.print_or_submit_changes(all_bug_changes)

    def generate_bug_changes(self, startday, endday, alt_startday, alt_endday):
        """Returns a list of dicts containing a bug id, a bug comment (only
        for bugs whose total number of daily or weekly occurrences meet
        the appropriate threshold) and potentially an updated whiteboard
        or priority status."""

        bug_ids, bugs = self.get_bugs(startday, endday)
        option_collection_map = OptionCollection.objects.get_option_collection_map()
        bug_map = self.build_bug_map(bugs, option_collection_map, startday, endday)

        alt_date_bug_totals = self.get_alt_date_bug_totals(alt_startday, alt_endday, bug_ids)

        # if fetch_bug_details fails, None is returned
        bugs_info = self.fetch_all_bug_details(bug_ids)
        all_bug_changes = []

        with open("treeherder/intermittents_commenter/comment.template") as template_file:
            template = Template(template_file.read())

        top_bugs = []
        if self.weekly_mode:
            top_bugs = [
                bug[0] for bug in sorted(bug_map.items(), key=lambda x: x[1].total, reverse=True)
            ][:50]

        for bug_id, counts in bug_map.items():
            change_priority = None
            change_whiteboard = None
            priority = 0
            rank = top_bugs.index(bug_id) + 1 if self.weekly_mode and bug_id in top_bugs else None
            if bugs_info and bug_id in bugs_info:
                if self.weekly_mode:
                    priority = self.assign_priority(counts)
                    if priority == 2:
                        change_priority, change_whiteboard = self.check_needswork_owner(
                            bugs_info[bug_id]
                        )

                    # change [stockwell needswork] to [stockwell unknown] when failures drop below 20 failures/week
                    # if this block is true, it implies a priority of 0 (mutually exclusive to previous block)
                    if counts.total < 20:
                        change_whiteboard = self.check_needswork(bugs_info[bug_id]["whiteboard"])

                else:
                    change_priority, change_whiteboard = self.check_needswork_owner(
                        bugs_info[bug_id]
                    )

                # recommend disabling when more than 150 failures tracked over 21 days and
                # takes precedence over any prevous change_whiteboard assignments
                if bug_id in alt_date_bug_totals and not self.check_whiteboard_status(
                    bugs_info[bug_id]["whiteboard"]
                ):
                    priority = 3
                    change_whiteboard = bugs_info[bug_id]["whiteboard"].replace(
                        "[stockwell unknown]", ""
                    )
                    change_whiteboard = re.sub(
                        r"\s*\[stockwell needswork[^\]]*\]\s*", "", change_whiteboard
                    ).strip()
                    change_whiteboard += "[stockwell disable-recommended]"
            comment = template.render(
                bug_id=bug_id,
                total=counts.total,
                rank=rank,
                priority=priority,
                repositories=counts.per_repositories,
                test_variants=sorted(list(counts.test_variants)),
                data_table=counts.data_table,
                startday=startday,
                endday=endday.split()[0],
                weekly_mode=self.weekly_mode,
            )

            bug_changes = {"bug_id": bug_id, "changes": {"comment": {"body": comment}}}

            if change_whiteboard:
                bug_changes["changes"]["whiteboard"] = change_whiteboard

            if change_priority:
                bug_changes["changes"]["priority"] = change_priority

            all_bug_changes.append(bug_changes)

        return all_bug_changes

    def check_needswork_owner(self, bug_info):
        change_priority = None
        change_whiteboard = None

        if (
            [bug_info["product"], bug_info["component"]] in COMPONENTS
        ) and not self.check_whiteboard_status(bug_info["whiteboard"]):
            if bug_info["priority"] not in ["--", "P1", "P2", "P3"]:
                change_priority = "--"

            stockwell_labels = re.findall(r"(\[stockwell .+?\])", bug_info["whiteboard"])
            # update whiteboard text unless it already contains WHITEBOARD_NEEDSWORK_OWNER
            if WHITEBOARD_NEEDSWORK_OWNER not in stockwell_labels:
                change_whiteboard = bug_info["whiteboard"] + WHITEBOARD_NEEDSWORK_OWNER

        return change_priority, change_whiteboard

    def check_needswork(self, whiteboard):
        stockwell_labels = re.findall(r"\[stockwell needswork[^\]]*\]", whiteboard)
        if len(stockwell_labels) == 0:
            return None
        # update all [stockwell needswork] bugs (including all 'needswork' possibilities,
        # ie 'needswork:owner') and update whiteboard to [stockwell unknown]
        change_whiteboard = re.sub(r"\s*\[stockwell needswork[^\]]*\]\s*", "", whiteboard).strip()
        return change_whiteboard + "[stockwell unknown]"

    def assign_priority(self, counts):
        priority = 0
        if counts.total >= 75:
            priority = 1
        elif counts.total >= 30:
            priority = 2

        return priority

    def print_or_submit_changes(self, all_bug_changes):
        for bug in all_bug_changes:
            if self.dry_run:
                logger.info("\n" + bug["changes"]["comment"]["body"] + "\n")
            elif settings.COMMENTER_API_KEY is None:
                # prevent duplicate comments when on stage/dev
                pass
            else:
                self.submit_bug_changes(bug["changes"], bug["bug_id"])
                # sleep between comment submissions to avoid overwhelming servers
                time.sleep(0.5)

        logger.warning(
            "There were {} comments for this {} task.".format(
                len(all_bug_changes), "weekly" if self.weekly_mode else "daily"
            )
        )

    def calculate_date_strings(self, mode, num_days):
        """Returns a tuple of start (in YYYY-MM-DD format) and end date
        strings (in YYYY-MM-DD HH:MM:SS format for an inclusive day)."""

        yesterday = date.today() - timedelta(days=1)
        endday = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59, 999)
        if mode:
            startday = yesterday - timedelta(days=num_days)
        else:
            # daily mode
            startday = yesterday

        return startday.isoformat(), endday.strftime("%Y-%m-%d %H:%M:%S.%f")

    def check_whiteboard_status(self, whiteboard):
        """Extracts stockwell text from a bug's whiteboard status to
        determine whether it matches specified stockwell text;
        returns a boolean."""

        stockwell_text = re.search(r"\[stockwell (.+?)\]", whiteboard)
        if stockwell_text is not None:
            text = stockwell_text.group(1).split(":")[0]
            if text == "fixed" or text == "infra" or "disable" in text:
                return True
        return False

    def new_request(self):
        session = requests.Session()
        # Use a custom HTTP adapter, so we can set a non-zero max_retries value.
        session.mount("https://", requests.adapters.HTTPAdapter(max_retries=3))
        session.headers = {
            "User-Agent": f"treeherder/{settings.SITE_HOSTNAME}",
            "x-bugzilla-api-key": settings.COMMENTER_API_KEY,
            "Accept": "application/json",
        }
        return session

    def fetch_bug_details(self, bug_ids):
        """Fetches bug metadata from bugzilla and returns an encoded
        dict if successful, otherwise returns None."""

        params = {"include_fields": "product, component, priority, whiteboard, id"}
        params["id"] = bug_ids
        try:
            response = self.session.get(
                settings.BZ_API_URL + "/rest/bug",
                headers=self.session.headers,
                params=params,
                timeout=30,
            )
            response.raise_for_status()
        except RequestException as e:
            logger.warning(f"error fetching bugzilla metadata for bugs due to {e}")
            return None

        if response.headers["Content-Type"] == "text/html; charset=UTF-8":
            return None

        data = response.json()
        if "bugs" not in data:
            return None

        return data["bugs"]

    def submit_bug_changes(self, changes, bug_id):
        url = f"{settings.BZ_API_URL}/rest/bug/{str(bug_id)}"
        try:
            response = self.session.put(url, headers=self.session.headers, json=changes, timeout=30)
            response.raise_for_status()
        except RequestException as e:
            logger.error(f"error posting comment to bugzilla for bug {bug_id} due to {e}")

    def get_bugs(self, startday, endday):
        """Get all intermittent failures per specified date range and repository,"""
        # Min required failures per bug in order to post a comment
        threshold = 1 if self.weekly_mode else 15
        bug_ids = (
            BugJobMap.failures.by_date(startday, endday)
            .filter(bug__bugzilla_id__isnull=False)
            .values("bug__bugzilla_id")
            .annotate(total=Count("bug__bugzilla_id"))
            .filter(total__gte=threshold)
            .values_list("bug__bugzilla_id", flat=True)
        )
        bugs = (
            BugJobMap.failures.by_date(startday, endday)
            .filter(bug__bugzilla_id__in=bug_ids)
            .order_by("job__machine_platform__platform")
            .values(
                "job__repository__name",
                "job__machine_platform__platform",
                "job__machine_platform__architecture",
                "job__machine_platform__os_name",
                "bug__bugzilla_id",
                "job__option_collection_hash",
                "job__signature__job_type_name",
                "bug__summary",
            )
        )
        return bug_ids, bugs

    def get_test_variant(self, test_suite):
        test_variants = (
            fetch.fetch_test_variants() if self.test_variants is None else self.test_variants
        )
        self.test_variants = test_variants
        # iterate through variants, allow for Base-[variant_list]
        variant_symbols = sorted(
            [
                test_variants[v]["suffix"]
                for v in test_variants
                if test_variants[v].get("suffix", "")
            ],
            key=len,
            reverse=True,
        )
        # strip known variants
        # build a list of known variants
        base_symbol = test_suite
        found_variants = []
        for variant in variant_symbols:
            if f"-{variant}-" in base_symbol or base_symbol.endswith(variant):
                found_variants.append(variant)
                base_symbol = base_symbol.replace(f"-{variant}", "")
        if not found_variants:
            return "no_variant"
        return "-".join(found_variants)

    def get_all_test_variants(self, bug_run_info, testrun_os_matrix):
        """
        Try to provide a mapping between the artifact giving the manifest
        and the data available in treeherder.
        TODO: not very consistant
        """
        variants = set()
        for key_version in testrun_os_matrix:
            if key_version.replace(".", "") in bug_run_info.os_version:
                for key_arch in testrun_os_matrix[key_version]:
                    variants = set(testrun_os_matrix[key_version][key_arch].keys())
        variants.add("no_variant")  # this is an assumption, we might not always have this
        return variants

    def get_bug_run_info(self, bug):
        all_platforms = ["linux", "mac", "windows", "android"]
        info = BugRunInfo()
        raw_data = bug["job__signature__job_type_name"]
        # platform, os, version
        info.platform = "linux"
        info.os_name = "linux"
        for substr in raw_data.split("-"):
            if any((current_platform := platform) in substr for platform in all_platforms):
                info.platform = substr
                info.os_name = current_platform
                info.os_version = substr.replace(info.os_name, "")
                break
        # architecture
        info.arch = "x86"
        if "-64" in raw_data:
            info.arch = "x86_64"
        elif "-aarch64" in raw_data:
            info.arch = "aarch64"
        # variant
        info.current_variant = self.get_test_variant(raw_data)
        info.variants.add(info.current_variant)
        # build_type
        # build types can be asan/opt, etc.,
        # so make sure that we search for 'debug' and 'opt' after other build_types
        build_types = ["asan", "tsan", "ccov", "debug", "opt"]
        for b_type in build_types:
            if b_type in raw_data:
                info.build_type = b_type
                break
        if not info.build_type:
            info.build_type = "unknown build"
        return info

    def get_task_labels_and_count(self, manifest, start_day, end_day):
        tasks_and_count = {}
        summary_groups = (
            fetch.fetch_summary_groups(start_day, end_day)
            if self.summary_groups is None
            else self.summary_groups
        )
        days = [start_day]
        if self.weekly_mode:
            for j in range(6):
                jj = datetime.strptime(days[-1], "%Y-%m-%d") + timedelta(days=1)
                days.append(jj.strftime("%Y-%m-%d"))
        for day in days:
            if day not in summary_groups:
                continue
            all_task_labels = summary_groups[day]["job_type_names"]
            for tasks_by_manifest in summary_groups[day]["manifests"]:
                for man, tasks in tasks_by_manifest.items():
                    if manifest == man:
                        for task_index, _, _, count in tasks:
                            task_label = all_task_labels[task_index]
                            tasks_and_count.setdefault(task_label, 0)
                            tasks_and_count[task_label] += count
        return tasks_and_count

    def build_bug_map(self, bugs, option_collection_map, start_day, end_day):
        """Build bug_map
         eg:
        {
            "1206327": {
                "total": 5,
                "per_repository": {
                    "fx-team": 2,
                    "autoland": 3
                },
                "test_variants": {'no-variant', 'swr', ...},
                "data_table": {
                    "windows10-64/ccov": {
                        "mochitest-browser-chrome": 0,
                        "mochitest-browser-chrome-swr": 2,
                    },
                    "windows10-64/debug": {
                         "mochitest-browser-chrome-swr": 2,
                    },
                    "osx-10-10/debug": {
                         "mochitest-browser-chrome": 2,
                         "mochitest-browser-chrome-swr": 0,
                    },
                },
            },
        }
        """
        bug_map = {}
        all_variants = set()
        for bug in bugs:
            bug_id = bug["bug__bugzilla_id"]
            all_tests = self.get_tests_from_manifests()
            test_name = self.get_test_name(all_tests, bug["bug__summary"])
            manifest = None
            bug_testrun_matrix = []
            run_count = 0
            if test_name:
                manifest = all_tests[test_name][0]
                if manifest:
                    tasks_count = self.get_task_labels_and_count(manifest, start_day, end_day)
                    job_name = bug["job__signature__job_type_name"]
                    for task_name, count in tasks_count.items():
                        if task_name == job_name or task_name == job_name.rsplit("-", 1)[0]:
                            run_count = count
                            break
                    testrun_matrix = (
                        fetch.fetch_testrun_matrix()
                        if self.testrun_matrix is None
                        else self.testrun_matrix
                    )
                    self.testrun_matrix = testrun_matrix
                    bug_testrun_matrix = testrun_matrix[manifest]
            bug_run_info = self.get_bug_run_info(bug)
            all_variants = bug_run_info.variants
            if bug_testrun_matrix and bug_run_info.os_name in bug_testrun_matrix:
                testrun_os_matrix = bug_testrun_matrix[bug_run_info.os_name]
                all_variants |= self.get_all_test_variants(bug_run_info, testrun_os_matrix)
            repo = bug["job__repository__name"]
            test_variant = bug_run_info.current_variant
            if bug_run_info.arch:
                platform_and_build = (
                    f"{bug_run_info.platform}-{bug_run_info.arch}/{bug_run_info.build_type}"
                )
            else:
                platform_and_build = f"{bug_run_info.platform}/{bug_run_info.build_type}"
            if bug_id not in bug_map:
                bug_infos = BugsDetails()
                bug_infos.total = 1
                bug_infos.test_variants |= all_variants
                bug_infos.per_repositories[repo] = 1
                bug_infos.data_table[platform_and_build] = {
                    test_variant: {"count": 1, "runs": run_count},
                }
                bug_map[bug_id] = bug_infos
            else:
                bug_infos = bug_map[bug_id]
                bug_infos.total += 1
                bug_infos.test_variants |= all_variants
                bug_infos.per_repositories.setdefault(repo, 0)
                bug_infos.per_repositories[repo] += 1
                # data_table
                data_table = bug_infos.data_table
                platform_and_build_data = data_table.get(platform_and_build, {})
                data_table[platform_and_build] = platform_and_build_data
                data_table[platform_and_build][test_variant] = {"count": 1, "runs": run_count}
        return bug_map

    def get_alt_date_bug_totals(self, startday, endday, bug_ids):
        """use previously fetched bug_ids to check for total failures
        exceeding 150 in 21 days"""
        bugs = (
            BugJobMap.failures.by_date(startday, endday)
            .filter(bug_id__in=bug_ids)
            .values("bug_id")
            .annotate(total=Count("id"))
            .values("bug_id", "total")
        )

        return {bug["bug_id"]: bug["total"] for bug in bugs if bug["total"] >= 150}

    def fetch_all_bug_details(self, bug_ids):
        """batch requests for bugzilla data in groups of 1200 (which is the safe
        limit for not hitting the max url length)"""
        min = 0
        max = 600
        bugs_list = []
        bug_ids_length = len(bug_ids)

        while bug_ids_length >= min and bug_ids_length > 0:
            data = self.fetch_bug_details(bug_ids[min:max])
            if data:
                bugs_list += data
            min = max
            max = max + 600

        return {bug["id"]: bug for bug in bugs_list} if len(bugs_list) else None

    def get_tests_from_manifests(self):
        manifests = fetch.fetch_test_manifests() if self.manifests is None else self.manifests
        self.manifests = manifests
        all_tests = {}
        for component in manifests["tests"]:
            for item in manifests["tests"][component]:
                if item["test"] not in all_tests:
                    all_tests[item["test"]] = []
                # split(':') allows for parent:child where we want to keep parent
                all_tests[item["test"]].append(item["manifest"][0].split(":")[0])
        return all_tests

    def fix_wpt_name(self, test_name):
        # TODO: keep this updated with wpt changes to:
        # https://searchfox.org/mozilla-central/source/testing/web-platform/tests/tools/serve/serve.py#273
        if (
            ".https.any.shadowrealm-in-serviceworker.html" in test_name
            or ".https.any.shadowrealm-in-audioworklet.html" in test_name
        ):
            test_name = f"{test_name.split('.https.any.')[0]}.any.js"
        elif ".any." in test_name:
            test_name = f"{test_name.split('.any.')[0]}.any.js"
        if ".window.html" in test_name:
            test_name = test_name.replace(".window.html", ".window.js")
        if ".worker.html" in test_name:
            test_name = test_name.replace(".worker.html", ".worker.js")
        if test_name.startswith("/mozilla/tests"):
            test_name = test_name.replace("/mozilla/", "mozilla/")
        if test_name.startswith("mozilla/tests"):
            test_name = f"testing/web-platform/{test_name}"
        else:
            test_name = "testing/web-platform/tests/" + test_name.strip("/")
        # some wpt tests have params, those are not supported
        test_name = test_name.split("?")[0]
        return test_name

    def get_test_name(self, all_tests, summary):
        tv_strings = [
            " TV ",
            " TV-nofis ",
            "[TV]",
            " TVW ",
            "[TVW]",
            " TC ",
            "[TC]",
            " TCW ",
            "[TCW]",
        ]
        test_file_extensions = [
            "html",
            "html (finished)",
            "js",
            "js (finished)",
            "py",
            "htm",
            "xht",
            "svg",
            "mp4",
        ]
        # ensure format we want
        if "| single tracking bug" not in summary:
            return None
        # ignore chrome://, file://, resource://, http[s]://, etc.
        if "://" in summary:
            return None
        # ignore test-verify as these run only on demand when the specific test is modified
        if any(k for k in tv_strings if k.lower() in summary.lower()):
            return None
        # now parse and try to find file in list of tests
        if any(k for k in test_file_extensions if f"{k} | single" in summary):
            if " (finished)" in summary:
                summary = summary.replace(" (finished)", "")
            # get <test_name> from: "TEST-UNEXPECTED-FAIL | <test_name> | single tracking bug"
            # TODO: fix reftest
            test_name = summary.split("|")[-2].strip()
            if " == " in test_name or " != " in test_name:
                test_name = test_name.split(" ")[0]
            else:
                test_name = test_name.split(" ")[-1]
            # comm/ is thunderbird, not in mozilla-central repo
            # "-ref" is related to a reftest reference file, not what we want to target
            # if no <path>/<filename>, then we won't be able to find in repo, ignore
            if test_name.startswith("comm/") or "-ref" in test_name or "/" not in test_name:
                return None
            # handle known WPT mapping
            if test_name.startswith("/") or test_name.startswith("mozilla/tests"):
                test_name = self.fix_wpt_name(test_name)
            if test_name not in all_tests:
                # try reftest:
                if f"layout/reftests/{test_name}" in all_tests:
                    test_name = f"layout/reftests/{test_name}"
                else:
                    # unknown test
                    # TODO: we get here for a few reasons:
                    # 1) test has moved in the source tree
                    # 2) test has typo in summary
                    # 3) test has been deleted from the source tree
                    # 4) sometimes test was deleted but is valid on beta
                    return None
            return test_name
        return None
