import logging
from datetime import datetime, timedelta

import dateutil.parser
import requests
from django.conf import settings
from django.db.models import Count, Max

from treeherder.model.models import BugJobMap, Bugscache
from treeherder.utils.github import fetch_json
from treeherder.utils.http import make_request

logger = logging.getLogger(__name__)


def reopen_request(url, method, headers, json):
    make_request(url, method=method, headers=headers, json=json)


def reopen_intermittent_bugs(minimum_failures_to_reopen=1):
    # Don't reopen bugs from non-production deployments.
    if settings.BUGFILER_API_KEY is None:
        return

    incomplete_bugs = set(
        Bugscache.objects.filter(resolution="INCOMPLETE", bugzilla_id__isnull=False).values_list(
            "bugzilla_id", flat=True
        )
    )
    # Intermittent bugs get closed after 3 weeks of inactivity if other conditions don't apply:
    # https://github.com/mozilla/relman-auto-nag/blob/c7439e247677333c1cd8c435234b3ef3adc49680/auto_nag/scripts/close_intermittents.py#L17
    recent_days = 7
    recently_used_bugs = set(
        BugJobMap.objects.filter(created__gt=(datetime.now() - timedelta(recent_days)))
        .filter(bug__bugzilla_id__isnull=False)
        .values("bug__bugzilla_id")
        .annotate(num_failures=Count("bug__bugzilla_id"))
        .filter(num_failures__gte=minimum_failures_to_reopen)
        .values_list("bug__bugzilla_id", flat=True)
    )
    bugs_to_reopen = incomplete_bugs & recently_used_bugs

    for bugzilla_id in bugs_to_reopen:
        bug_data = (
            BugJobMap.objects.filter(bug__bugzilla_id=bugzilla_id)
            .select_related("job__repository")
            .order_by("-created")
            .values("job_id", "job__repository__name")[0]
        )
        job_id = bug_data.get("job_id")
        repository = bug_data.get("job__repository__name")
        log_url = f"https://treeherder.mozilla.org/logviewer?job_id={job_id}&repo={repository}"

        comment = {"body": "New failure instance: " + log_url}
        url = settings.BUGFILER_API_URL + "/rest/bug/" + str(bugzilla_id)
        headers = {
            "x-bugzilla-api-key": settings.BUGFILER_API_KEY,
            "Accept": "application/json",
        }
        data = {
            "status": "REOPENED",
            "comment": comment,
            "comment_tags": "treeherder",
        }

        try:
            reopen_request(url, method="PUT", headers=headers, json=data)
            # NOTE: this will only toggle 1 bug_job_map entry, not all (if there are retriggers)
            BugJobMap.objects.filter(job_id=job_id, bug__bugzilla_id=bugzilla_id).update(
                bug_open=True
            )
        except requests.exceptions.HTTPError as e:
            try:
                message = e.response.json()["message"]
            except (ValueError, KeyError):
                message = e.response.text
            logger.error(f"Reopening bug {str(bugzilla_id)} failed: {message}")


def fetch_intermittent_bugs(additional_params, limit, duplicate_chain_length):
    url = settings.BZ_API_URL + "/rest/bug"
    params = {
        "include_fields": ",".join(
            [
                "id",
                "summary",
                "status",
                "resolution",
                "dupe_of",
                "duplicates",
                "cf_crash_signature",
                "keywords",
                "last_change_time",
                "whiteboard",
            ]
        ),
        "limit": limit,
    }
    params.update(additional_params)
    response = fetch_json(url, params=params)
    return response.get("bugs", [])


class BzApiBugProcess:
    minimum_failures_to_reopen = 3

    def run(self):
        year_ago = datetime.utcnow() - timedelta(days=365)
        last_change_time_max = (
            Bugscache.objects.filter(bugzilla_id__isnull=False).aggregate(Max("modified"))[
                "modified__max"
            ]
            or None
        )
        if last_change_time_max:
            last_change_time_max -= timedelta(minutes=10)
        else:
            last_change_time_max = year_ago

        max_summary_length = Bugscache._meta.get_field("summary").max_length
        max_whiteboard_length = Bugscache._meta.get_field("whiteboard").max_length

        last_change_time_string = last_change_time_max.strftime("%Y-%m-%dT%H:%M:%SZ")

        bugs_to_duplicates = {}
        duplicates_to_bugs = {}
        insert_errors_observed = False
        duplicates_to_check = set()

        # The bugs are ingested in different phases:
        # 1. Intermittent bugs with activity in the bug in the last year
        #    (Bugzilla seed). Iteration 0.
        # 2. Bugs used for classification (classification seed). They will be
        #    part of the previous phase once a report about the classification
        #    has been posted in the bug (schedule weekly or daily).
        #    Processed as part of iteration 1.
        # 3. For bugs which have been resolved as duplicates, the bugs as whose
        #    duplicates they have been set will be fetched. The open bugs will
        #    be used to store the classifications. Iterations 1-5.
        # 4. Duplicates of the bugs from previous phases get fetched. Duplicate
        #    bugs included in those eventually end up here due to inactivity but
        #    are still needed for matching failure lines against bug summaries.
        #    Iterations 6-10.

        duplicate_chain_length = -1
        # make flake8 happy
        bugs_to_process = []
        while duplicate_chain_length < 10:
            duplicate_chain_length += 1
            if duplicate_chain_length > 0:
                bugs_to_process = list(
                    bugs_to_process
                    - set(
                        Bugscache.objects.filter(
                            processed_update=True, bugzilla_id__isnull=False
                        ).values_list("bugzilla_id", flat=True)
                    )
                )
                if len(bugs_to_process) == 0:
                    break

            bug_list = []
            bugs_count_limit = 500
            bugs_offset = 0

            # Keep querying Bugzilla until there are no more results.
            while True:
                if duplicate_chain_length == 0:
                    additional_params = {
                        "keywords": "intermittent-failure",
                        "last_change_time": last_change_time_string,
                        "offset": bugs_offset,
                    }
                else:
                    additional_params = {
                        "id": ",".join(
                            list(
                                map(
                                    str,
                                    bugs_to_process[bugs_offset : bugs_offset + bugs_count_limit],
                                )
                            )
                        ),
                    }
                bug_results_chunk = fetch_intermittent_bugs(
                    additional_params, bugs_count_limit, duplicate_chain_length
                )
                bug_list += bug_results_chunk
                bugs_offset += bugs_count_limit
                if duplicate_chain_length == 0 and len(bug_results_chunk) < bugs_count_limit:
                    break
                if duplicate_chain_length > 0 and bugs_offset >= len(bugs_to_process):
                    break

            bugs_to_process_next = set()

            if bug_list:
                if duplicate_chain_length == 0:
                    Bugscache.objects.exclude(summary="(no bug data fetched)").exclude(
                        bugzilla_id__in=BugJobMap.objects.distinct("bug__bugzilla_id").values_list(
                            "bug__bugzilla_id", flat=True
                        )
                    ).filter(modified__lt=year_ago, bugzilla_id__isnull=False).delete()
                    Bugscache.objects.filter(bugzilla_id__isnull=False).update(
                        processed_update=False
                    )

                for bug in bug_list:
                    # we currently don't support timezones in treeherder, so
                    # just ignore it when importing/updating the bug to avoid
                    # a ValueError
                    try:
                        dupe_of = bug.get("dupe_of", None)
                        if (
                            dupe_of is not None
                            and not Bugscache.objects.filter(bugzilla_id=dupe_of).exists()
                        ):
                            Bugscache.objects.update_or_create(
                                bugzilla_id=dupe_of,
                                defaults={
                                    "modified": datetime(1971, 1, 1),
                                    "summary": "(no bug data fetched)",
                                    "processed_update": False,
                                },
                            )
                        Bugscache.objects.update_or_create(
                            bugzilla_id=bug["id"],
                            defaults={
                                "status": bug.get("status", ""),
                                "resolution": bug.get("resolution", ""),
                                "summary": bug.get("summary", "")[:max_summary_length],
                                "dupe_of": dupe_of,
                                "crash_signature": bug.get("cf_crash_signature", ""),
                                "keywords": ",".join(bug["keywords"]),
                                "modified": dateutil.parser.parse(
                                    bug["last_change_time"], ignoretz=True
                                ),
                                "whiteboard": bug.get("whiteboard", "")[:max_whiteboard_length],
                                "processed_update": True,
                            },
                        )
                    except Exception as e:
                        logger.error("error inserting bug '%s' into db: %s", bug, e)
                        insert_errors_observed = True
                        continue
                    if dupe_of is not None:
                        openish = (
                            duplicates_to_bugs[dupe_of]
                            if dupe_of in duplicates_to_bugs
                            else dupe_of
                        )
                        duplicates_to_bugs[bug["id"]] = openish
                        if openish not in bugs_to_duplicates:
                            bugs_to_process_next.add(openish)
                            bugs_to_duplicates[openish] = set()
                        bugs_to_duplicates[openish].add(bug["id"])
                        if bug["id"] in bugs_to_duplicates:
                            for duplicate_id in bugs_to_duplicates[bug["id"]]:
                                duplicates_to_bugs[duplicate_id] = openish
                            bugs_to_duplicates[openish] |= bugs_to_duplicates[bug["id"]]
                    duplicates = bug.get("duplicates")
                    if len(duplicates) > 0:
                        duplicates_to_check |= set(duplicates)

            if duplicate_chain_length == 0:
                # Phase 2: Bugs used for classification should be kept.
                # Can return invalid bug numbers (e.g. too large because of
                # typo) but they don't cause issues.
                # distinct('bug_id') is not supported by Django + MySQL 5.7
                bugs_to_process_next |= set(
                    BugJobMap.objects.filter(bug__bugzilla_id__isnull=False).values_list(
                        "bug__bugzilla_id", flat=True
                    )
                )
            bugs_to_process = bugs_to_process_next - set(
                Bugscache.objects.filter(processed_update=True).values_list(
                    "bugzilla_id", flat=True
                )
            )
            if duplicate_chain_length == 5 and len(bugs_to_process):
                logger.warn(
                    "Found a chain of duplicate bugs longer than 6 bugs, stopped following chain. Bugscache's 'dupe_of' column contains duplicates instead of non-duplicate bugs. Unprocessed bugs: "
                    + (" ".join(list(map(str, bugs_to_process))))
                )
            if 0 <= duplicate_chain_length < 6 and len(bugs_to_process) == 0:
                # phase 3: looking for open bugs based on duplicates
                duplicate_chain_length = 5
            if duplicate_chain_length >= 5:
                # phase 4: fetching duplicates
                bugs_to_process_next = duplicates_to_check
                duplicates_to_check = set()
                bugs_to_process = bugs_to_process_next - set(
                    Bugscache.objects.filter(
                        processed_update=True, bugzilla_id__isnull=False
                    ).values_list("bugzilla_id", flat=True)
                )
                if len(bugs_to_process) == 0:
                    break
                elif duplicate_chain_length == 10 and len(bugs_to_process):
                    logger.warn(
                        "Found a chain of duplicate bugs longer than 6 bugs, stopped following chain. Not all duplicates have been loaded. Unprocessed bugs: "
                        + (" ".join(list(map(str, bugs_to_process))))
                    )

        # Duplicate bugs don't see any activity. Use the modification date of
        # the bug against which they have been set as duplicate to prevent them
        # from getting dropped - they are still needed to match the failure line
        # against the bug summary.
        for bug_duplicate, bug_openish in duplicates_to_bugs.items():
            bug_openish_object = Bugscache.objects.filter(bugzilla_id=bug_openish)
            if len(bug_openish_object) == 0:
                # Script does not have access to open bug but to duplicate
                continue
            Bugscache.objects.filter(bugzilla_id=bug_duplicate).update(
                dupe_of=bug_openish, modified=bug_openish_object[0].modified
            )

        # Switch classifications from duplicate bugs to open ones.
        duplicates_db = set(
            Bugscache.objects.filter(dupe_of__isnull=False, bugzilla_id__isnull=False).values_list(
                "bugzilla_id", flat=True
            )
        )
        bugs_used = set(
            BugJobMap.objects.filter(bug__bugzilla_id__isnull=False).values_list(
                "bug__bugzilla_id", flat=True
            )
        )
        duplicates_used = duplicates_db & bugs_used
        for bugzilla_id in duplicates_used:
            dupe_of = Bugscache.objects.get(bugzilla_id=bugzilla_id).dupe_of
            # Jobs both already classified with new duplicate and its open bug.
            jobs_openish = list(
                BugJobMap.objects.filter(bug__bugzilla_id=dupe_of).values_list("job_id", flat=True)
            )
            # Delete annotations with duplicate bug for jobs which have also
            # been classified with the open bug of a duplicate bug.
            BugJobMap.objects.filter(bug__bugzilla_id=bugzilla_id, job_id__in=jobs_openish).delete()
            BugJobMap.objects.filter(bug__bugzilla_id=bugzilla_id).update(
                bug_id=Bugscache.objects.get(bugzilla_id=dupe_of)
            )

        # Delete open bugs and related duplicates if modification date (of open
        # bug) is too old.
        Bugscache.objects.exclude(
            bugzilla_id__in=BugJobMap.objects.distinct("bug__bugzilla_id").values_list(
                "bug__bugzilla_id", flat=True
            )
        ).filter(modified__lt=year_ago, bugzilla_id__isnull=False).delete()

        if insert_errors_observed:
            logger.error(
                "error inserting some bugs, bugscache is incomplete, bugs updated during run will be ingested again during the next run"
            )
            # Move modification date of bugs inserted/updated during this
            # run back to attempt to ingest bug data which failed during
            # this insert/update in the next run.
            Bugscache.objects.filter(
                modified__gt=last_change_time_max, bugzilla_id__isnull=False
            ).update(modified=last_change_time_max)

        reopen_intermittent_bugs(self.minimum_failures_to_reopen)
