import logging
import re
import time
from collections import Counter
from datetime import date, datetime, timedelta

import requests
import yaml
from django.conf import settings
from django.db.models import Count
from jinja2 import Template
from requests.exceptions import RequestException

from treeherder.intermittents_commenter.constants import (
    COMPONENTS,
    WHITEBOARD_NEEDSWORK_OWNER,
)
from treeherder.model.models import BugJobMap, OptionCollection, Push

logger = logging.getLogger(__name__)


class Commenter:
    """Handles fetching, composing and submitting bug comments based on
    daily or weekly thresholds and date range, and updating whiteboard
    and priority status as need; if in dry_run, comments will be output
    to stdout rather than submitting to bugzilla."""

    test_variants = None

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

        bug_stats, bug_ids = self.get_bug_stats(startday, endday)
        alt_date_bug_totals = self.get_alt_date_bug_totals(alt_startday, alt_endday, bug_ids)
        test_run_count = self.get_test_runs(startday, endday)

        # if fetch_bug_details fails, None is returned
        bugs_info = self.fetch_all_bug_details(bug_ids)
        all_bug_changes = []
        test_variants = set()

        with open("treeherder/intermittents_commenter/comment.template") as template_file:
            template = Template(template_file.read())

        top_bugs = []
        if self.weekly_mode:
            top_bugs = [
                bug[0]
                for bug in sorted(bug_stats.items(), key=lambda x: x[1]["total"], reverse=True)
            ][:50]

        for bug_id, counts in bug_stats.items():
            change_priority = None
            change_whiteboard = None
            priority = 0
            rank = top_bugs.index(bug_id) + 1 if self.weekly_mode and bug_id in top_bugs else None
            test_variants = bug_stats[bug_id]["test_variants"]

            if bugs_info and bug_id in bugs_info:
                if self.weekly_mode:
                    priority = self.assign_priority(counts)
                    if priority == 2:
                        change_priority, change_whiteboard = self.check_needswork_owner(
                            bugs_info[bug_id]
                        )

                    # change [stockwell needswork] to [stockwell unknown] when failures drop below 20 failures/week
                    # if this block is true, it implies a priority of 0 (mutually exclusive to previous block)
                    if counts["total"] < 20:
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
                total=counts["total"],
                test_run_count=test_run_count,
                rank=rank,
                priority=priority,
                failure_rate=round(counts["total"] / float(test_run_count), 3),
                repositories=counts["per_repository"],
                platforms=counts["per_platform"],
                test_variants=sorted(test_variants),
                test_suites=counts["test_suite_per_platform_and_build"],
                counts=counts,
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
        if counts["total"] >= 75:
            priority = 1
        elif counts["total"] >= 30:
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

    def get_test_runs(self, startday, endday):
        """Returns an aggregate of pushes for specified date range and
        repository."""

        test_runs = Push.objects.filter(time__range=(startday, endday)).aggregate(Count("author"))
        return test_runs["author__count"]

    def get_bug_stats(self, startday, endday):
        """Get all intermittent failures per specified date range and repository,
           returning a dict of bug_id's with total, repository test_suite and platform totals
           if totals are greater than or equal to the threshold.
        eg:
        {
            "1206327": {
                "total": 5,
                "per_repository": {
                    "fx-team": 2,
                    "autoland": 3
                },
                "per_platform": {
                    "windows10-64": 52,
                    "osx-10-10": 1,
                },
                "test_suite_per_platform_and_build": {
                    "windows10-64/debug" {
                        "mochitest-browser-chrome": 2,
                        "mochitest-browser-chrome-swr": 2,
                    },
                    "windows10-64/ccov" {
                        "mochitest-browser-chrome": 0,
                        "mochitest-browser-chrome-swr": 2,
                    },
                    "osx-10-10/debug": {
                        "mochitest-browser-chrome": 2,
                        "mochitest-browser-chrome-swr": 0,
                    },
                },
                "windows10-64": {
                    "debug": 30,
                    "ccov": 20,
                    "asan": 2,
                },
                "osx-10-10": {
                    "debug": 1,
                }
            }
        }
        """
        # Min required failures per bug in order to post a comment
        threshold = 1 if self.weekly_mode else 15
        bug_ids = (
            BugJobMap.failures.by_date(startday, endday)
            .values("bug_id")
            .annotate(total=Count("bug_id"))
            .filter(total__gte=threshold)
            .values_list("bug_id", flat=True)
        )
        bugs = (
            BugJobMap.failures.by_date(startday, endday)
            .filter(bug_id__in=bug_ids)
            .order_by("job__machine_platform__platform")
            .values(
                "job__repository__name",
                "job__machine_platform__platform",
                "job__machine_platform__architecture",
                "bug_id",
                "job__option_collection_hash",
                "job__signature__job_type_name",
            )
        )
        option_collection_map = OptionCollection.objects.get_option_collection_map()
        bug_map = self.build_bug_map(bugs, option_collection_map)
        return bug_map, bug_ids

    def fetch_test_variants(self):
        mozilla_central_url = "https://hg.mozilla.org/mozilla-central"
        variant_file_url = f"{mozilla_central_url}/raw-file/tip/taskcluster/kinds/test/variants.yml"
        response = requests.get(variant_file_url, headers={"User-agent": "mach-test-info/1.0"})
        self.test_variants = yaml.safe_load(response.text)
        return self.test_variants

    def get_test_variant(self, test_suite):
        test_variants = (
            self.fetch_test_variants() if self.test_variants is None else self.test_variants
        )
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

    def build_bug_map(self, bugs, option_collection_map):
        """Returning a dict of bug_id's with total, repository, test_suite and platform totals"""
        bug_map = dict()
        for bug in bugs:
            platform = bug["job__machine_platform__platform"]
            platform = platform.replace("-shippable", "")
            architecture = bug["job__machine_platform__architecture"]
            repo = bug["job__repository__name"]
            bug_id = bug["bug_id"]
            build_type = option_collection_map.get(
                bug["job__option_collection_hash"], "unknown build"
            )
            test_variant = self.get_test_variant(bug["job__signature__job_type_name"])
            platform_and_build = f"{platform}/{architecture}/{build_type}"
            if bug_id not in bug_map:
                bug_infos = {
                    "total": 1,
                    "test_variants": set([test_variant]),
                    "per_platform": Counter([platform]),
                    "test_suite_per_platform_and_build": {
                        platform_and_build: Counter([test_variant])
                    },
                    "per_repository": Counter([repo]),
                    platform: Counter([build_type]),
                }
            else:
                bug_infos = bug_map[bug_id]
                bug_infos["total"] += 1
                bug_infos["test_variants"].add(test_variant)
                bug_infos["per_repository"][repo] += 1
                bug_infos["per_platform"][platform] += 1
                if platform_and_build in bug_infos["test_suite_per_platform_and_build"]:
                    bug_infos["test_suite_per_platform_and_build"][platform_and_build][
                        test_variant
                    ] += 1
                else:
                    bug_infos["test_suite_per_platform_and_build"][platform_and_build] = Counter(
                        [test_variant]
                    )
                if bug_infos.get(platform):
                    bug_infos[platform][build_type] += 1
                else:
                    bug_infos[platform] = Counter([build_type])
            bug_map[bug_id] = bug_infos
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
