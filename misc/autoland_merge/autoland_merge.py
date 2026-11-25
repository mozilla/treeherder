#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "pyyaml"]
# ///
import argparse
import base64
import functools
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import requests
import yaml

logger = logging.getLogger("autoland_merge")

AUTOLAND = "autoland"
MAIN = "mozilla-central"
COMMIT_MESSAGE = "Merge autoland to mozilla-central"
MAX_FIXES = 4
USER_AGENT = "autoland-merge-script"
HTTP_TIMEOUT = 60

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_NOT_MERGEABLE = 2
EXIT_NOTHING_TO_DO = 3
EXIT_MISMATCH = 4

FAILURE_RESULTS = frozenset({"testfailed", "busted", "exception"})
ACCEPTABLE_IDS = frozenset({3, 4, 5, 7, 8})
FIXED_BY_COMMIT_ID = 2
FIXED_BY_COMMIT_NAME = "fixed by commit"
CLASSIFICATION_NAMES = {
    1: "not classified",
    2: "fixed by commit",
    3: "expected fail",
    4: "intermittent",
    5: "infra",
    6: "new failure not classified",
    7: "autoclassified intermittent",
    8: "intermittent needs bugid",
}
INCOMPLETE_STATES = frozenset({"pending", "running"})
HASH_RE = re.compile(r"(?<![0-9a-f])([0-9a-f]{40})(?![0-9a-f])")
REVISION_RE = re.compile(r"[0-9a-f]{12,40}")
PATCH_HEADER_RE = re.compile(rb"^From ([0-9a-f]{40}) Mon Sep 17 00:00:00 2001$", re.MULTILINE)

LANDO_TERMINAL_OK = frozenset({"LANDED"})
LANDO_TERMINAL_FAILED = frozenset({"FAILED", "CANCELLED", "ABORTED"})
LANDO_POLL_INTERVAL = 30
LANDO_TIMEOUT = 3600

JOBS_PAGE_SIZE = 2000
PUSHES_PAGE_SIZE = 50
MAX_PUSHES_PER_QUERY = 1000
MAX_SAME_PUSH_CHERRY_PICKS = 10
IGNORED_MAIN_PUSH_AUTHORS = frozenset({"ffxbld@lando.moz.tools"})
LATEST_BACKSTOP_LOOKBACK = 200
PUSHES_PER_COMPARISON_LOOKBACK = 150


class MergeError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    treeherder_url: str = "https://treeherder.mozilla.org"
    taskcluster_root_url: str = "https://firefox-ci-tc.services.mozilla.com"
    lando_url: str = "https://lando.moz.tools"
    lando_repo: str = "firefox-main"
    lando_hg2git_repo: str = "firefox"
    github_url: str = "https://github.com"
    github_repo: str = "mozilla-firefox/firefox"


@dataclass(eq=False)
class Api:
    config: Config = field(default_factory=Config)
    lando_token: str | None = None
    session: requests.Session = field(default_factory=requests.Session)
    cache_dir: Path | None = None

    def __post_init__(self):
        self.session.headers["User-Agent"] = USER_AGENT


@dataclass
class Commit:
    revision: str
    author: str
    subject: str

    @classmethod
    def from_api(cls, data):
        lines = (data.get("comments") or "").splitlines()
        return cls(
            revision=data["revision"],
            author=data.get("author") or "",
            subject=lines[0].strip() if lines else "",
        )


@dataclass
class Push:
    id: int
    revision: str
    commits: list[Commit]
    revision_count: int
    push_timestamp: int = 0
    author: str = ""

    @property
    def revisions(self):
        return [c.revision for c in self.commits]

    @classmethod
    def from_api(cls, data):
        return cls(
            id=data["id"],
            revision=data["revision"],
            commits=[Commit.from_api(r) for r in data.get("revisions", [])],
            revision_count=data.get("revision_count", 0),
            push_timestamp=data.get("push_timestamp") or 0,
            author=data.get("author") or "",
        )


@dataclass
class Job:
    id: int
    task_id: str
    job_type_name: str
    result: str
    state: str
    tier: int
    failure_classification_id: int

    @classmethod
    def from_api(cls, data):
        return cls(
            id=data["id"],
            task_id=data.get("task_id") or "",
            job_type_name=data.get("job_type_name") or "",
            result=data.get("result") or "",
            state=data.get("state") or "",
            tier=data.get("tier") or 1,
            failure_classification_id=data.get("failure_classification_id") or 1,
        )


@dataclass
class Fix:
    hg_revision: str
    push_id: int
    position: int
    subject: str
    jobs: list[str]
    git_revision: str = ""


@dataclass
class Decision:
    backstop: dict
    already_merged: bool = False
    verdict: str = "clean"
    reasons: list[str] = field(default_factory=list)
    failure_counts: dict[str, int] = field(default_factory=dict)
    blocking_jobs: list[Job] = field(default_factory=list)
    fixes: list[Fix] = field(default_factory=list)
    lando_job: dict | None = None

    def block(self, reason):
        self.reasons.append(reason)
        self.verdict = "blocked"


def cached_get(api, url, params, headers):
    key = json.dumps([url, sorted((params or {}).items())], default=str)
    path = api.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.json"
    if path.exists():
        data = json.loads(path.read_text())
        response = requests.Response()
        response.url = data["url"]
        response.status_code = data["status"]
        response.reason = data["reason"]
        response._content = base64.b64decode(data["body"])
        response.encoding = "utf-8"
        return response
    response = api.session.get(url, params=params, headers=headers, timeout=HTTP_TIMEOUT)
    if response.status_code < 400 or response.status_code == 404:
        api.cache_dir.mkdir(parents=True, exist_ok=True)
        record = {
            "url": response.url,
            "status": response.status_code,
            "reason": response.reason,
            "body": base64.b64encode(response.content).decode("ascii"),
        }
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(record))
        tmp.replace(path)
    return response


def get(api, url, params=None, headers=None, allow_404=False):
    if api.cache_dir is not None:
        response = cached_get(api, url, params, headers)
    else:
        response = api.session.get(url, params=params, headers=headers, timeout=HTTP_TIMEOUT)
    if allow_404 and response.status_code == 404:
        return None
    response.raise_for_status()
    return response


def get_json(api, url, params=None, headers=None, allow_404=False):
    response = get(api, url, params=params, headers=headers, allow_404=allow_404)
    return None if response is None else response.json()


def treeherder_url(api, project, path):
    return f"{api.config.treeherder_url}/api/project/{project}/{path}"


def push_url(api, project, push):
    return f"{api.config.treeherder_url}/jobs?repo={project}&revision={push.revision}"


def pushes(api, project, params):
    data = get_json(api, treeherder_url(api, project, "push/"), params=params)
    return [Push.from_api(p) for p in data["results"]]


@functools.cache
def pushes_containing(api, project, revision):
    return tuple(pushes(api, project, {"commit_revision": revision}))


@functools.cache
def pushes_after(api, project, push_id, until=None):
    found = []
    id_lt = None
    while True:
        params = {"id__gt": push_id, "count": MAX_PUSHES_PER_QUERY}
        if until is not None:
            params["push_timestamp__lte"] = until
        if id_lt is not None:
            params["id__lt"] = id_lt
        batch = pushes(api, project, params)
        found.extend(batch)
        if len(batch) < MAX_PUSHES_PER_QUERY:
            return tuple(sorted(found, key=lambda p: p.id))
        id_lt = min(p.id for p in batch)


def push_by_revision(api, revision):
    found = pushes(api, AUTOLAND, {"revision": revision})
    if not found:
        raise MergeError(f"No {AUTOLAND} push has tip revision {revision}")
    if len(found) > 1:
        raise MergeError(f"Revision prefix {revision} matches more than one {AUTOLAND} push")
    return found[0]


def decision_tasks(api, push_ids):
    data = get_json(
        api,
        treeherder_url(api, AUTOLAND, "push/decisiontask/"),
        params={"push_ids": ",".join(str(i) for i in push_ids)},
        allow_404=True,
    )
    if not isinstance(data, dict):
        return {}
    return {int(push_id): task["id"] for push_id, task in data.items()}


def jobs_for_push(api, push_id):
    jobs = []
    offset = 0
    while True:
        data = get_json(
            api,
            treeherder_url(api, AUTOLAND, "jobs/"),
            params={"push_id": push_id, "count": JOBS_PAGE_SIZE, "offset": offset},
        )
        jobs.extend(Job.from_api(j) for j in data["results"])
        if len(data["results"]) < JOBS_PAGE_SIZE:
            return jobs
        offset += JOBS_PAGE_SIZE


def push_notes(api, revision):
    return get_json(
        api, treeherder_url(api, AUTOLAND, "note/push_notes/"), params={"revision": revision}
    )


@functools.cache
def decision_task_is_backstop(api, task_id):
    url = (
        f"{api.config.taskcluster_root_url}/api/queue/v1/task/{task_id}"
        "/artifacts/public/parameters.yml"
    )
    response = get(api, url, allow_404=True)
    return response is not None and bool((yaml.safe_load(response.text) or {}).get("backstop"))


def is_backstop(api, push):
    task_id = decision_tasks(api, [push.id]).get(push.id)
    return bool(task_id) and decision_task_is_backstop(api, task_id)


def hg2git(api, hg_revision):
    data = get_json(
        api,
        f"{api.config.lando_url}/api/hg2git/{api.config.lando_hg2git_repo}/{hg_revision}",
        allow_404=True,
    )
    if not data or "git_hash" not in data:
        raise MergeError(f"Lando has no git mapping for hg revision {hg_revision}")
    return data["git_hash"]


def lando_headers(api):
    if not api.lando_token:
        raise MergeError("LANDO_HEADLESS_API_TOKEN is required to talk to the Lando API")
    return {"Authorization": f"Bearer {api.lando_token}"}


def lando_submit_url(api):
    return f"{api.config.lando_url}/api/repo/{api.config.lando_repo}"


def lando_submit(api, body):
    url = lando_submit_url(api)
    response = api.session.post(url, json=body, headers=lando_headers(api), timeout=HTTP_TIMEOUT)
    if response.status_code >= 400:
        raise MergeError(
            f"POST {url} failed with HTTP {response.status_code}: {response.text[:2000]}"
        )
    return response.json()


def lando_job_status(api, job_id):
    return get_json(api, f"{api.config.lando_url}/api/job/{job_id}", headers=lando_headers(api))


def fetch_patch(api, git_revision):
    url = f"{api.config.github_url}/{api.config.github_repo}/commit/{git_revision}.patch"
    patch = get(api, url).content
    if PATCH_HEADER_RE.findall(patch) != [git_revision.encode()]:
        raise MergeError(f"fix {git_revision} is not a single non-merge commit")
    return patch


def is_complete(jobs):
    return bool(jobs) and all(job.state not in INCOMPLETE_STATES for job in jobs)


def classify(jobs):
    counts = {}
    unclassified = []
    fixed = []
    for job in jobs:
        if job.tier > 2 or job.result not in FAILURE_RESULTS:
            continue
        cid = job.failure_classification_id
        name = CLASSIFICATION_NAMES.get(cid, str(cid))
        counts[name] = counts.get(name, 0) + 1
        if cid == FIXED_BY_COMMIT_ID:
            fixed.append(job)
        elif cid not in ACCEPTABLE_IDS:
            unclassified.append(job)
    return counts, unclassified, fixed


def parse_fix_revision(text):
    match = HASH_RE.search((text or "").lower())
    return match.group(1) if match else None


def extract_fixes(fix_jobs, notes):
    notes_by_task = {}
    for note in notes:
        task_id = (note.get("job") or {}).get("task_id")
        if task_id and note.get("failure_classification_name") == FIXED_BY_COMMIT_NAME:
            notes_by_task.setdefault(task_id, []).append(note)

    fixes = {}
    unresolved = []
    for job in fix_jobs:
        candidates = sorted(
            notes_by_task.get(job.task_id, []), key=lambda n: n.get("created") or "", reverse=True
        )
        revisions = (parse_fix_revision(n.get("text")) for n in candidates)
        revision = next((r for r in revisions if r), None)
        if revision is None:
            unresolved.append(job)
        else:
            fixes.setdefault(revision, []).append(job.job_type_name)
    return fixes, unresolved


def resolve_fixes(api, fix_jobs_by_revision, backstop):
    fixes = []
    reasons = []
    for revision, job_names in fix_jobs_by_revision.items():
        found = pushes_containing(api, AUTOLAND, revision)
        if not found:
            reasons.append(f"fix revision {revision} was not found on {AUTOLAND}")
            continue
        push = min(found, key=lambda p: p.id)
        if push.id <= backstop.id:
            continue
        revisions = push.revisions
        position = len(revisions) - 1 - revisions.index(revision) if revision in revisions else 0
        subject = next((c.subject for c in push.commits if c.revision == revision), "")
        fixes.append(Fix(revision, push.id, position, subject, job_names))
    fixes.sort(key=lambda f: (f.push_id, f.position))
    for fix in fixes:
        fix.git_revision = hg2git(api, fix.hg_revision)
    return fixes, reasons


def iter_completed_backstops(api, lookback):
    seen = 0
    id_lt = None
    while seen < lookback:
        params = {"count": PUSHES_PAGE_SIZE}
        if id_lt is not None:
            params["id__lt"] = id_lt
        page = pushes(api, AUTOLAND, params)
        if not page:
            return
        tasks = decision_tasks(api, [p.id for p in page])
        for push in page:
            task_id = tasks.get(push.id)
            if not task_id or not decision_task_is_backstop(api, task_id):
                continue
            jobs = jobs_for_push(api, push.id)
            if is_complete(jobs):
                yield push, jobs
            else:
                logger.info("Backstop push %s (%s) is not complete yet", push.id, push.revision)
        seen += len(page)
        id_lt = page[-1].id


def latest_completed_backstop(api):
    for push, jobs in iter_completed_backstops(api, LATEST_BACKSTOP_LOOKBACK):
        return push, jobs
    raise MergeError(
        f"No completed backstop push found in the last {LATEST_BACKSTOP_LOOKBACK} pushes"
    )


def load_backstop(api, revision):
    push = push_by_revision(api, revision)
    if not is_backstop(api, push):
        raise MergeError(f"Push {push.id} ({push.revision}) is not a backstop push")
    jobs = jobs_for_push(api, push.id)
    if not is_complete(jobs):
        logger.warning("Push %s still has unfinished jobs", push.id)
    return push, jobs


def main_push_containing(api, revision):
    found = pushes_containing(api, MAIN, revision)
    return min(found, key=lambda p: p.id) if found else None


def decide(api, push, jobs):
    decision = Decision(
        backstop={
            "push_id": push.id,
            "hg_revision": push.revision,
            "git_revision": hg2git(api, push.revision),
            "complete": is_complete(jobs),
            "treeherder_url": push_url(api, AUTOLAND, push),
        }
    )
    decision.failure_counts, unclassified, fixed = classify(jobs)
    if unclassified:
        decision.block(f"{len(unclassified)} unclassified failure(s)")
        decision.blocking_jobs.extend(unclassified)

    if fixed:
        by_revision, unresolved = extract_fixes(fixed, push_notes(api, push.revision))
        if unresolved:
            decision.block(
                f"{len(unresolved)} fixed-by-commit job(s) have no note with a full commit revision"
            )
            decision.blocking_jobs.extend(unresolved)
        decision.fixes, reasons = resolve_fixes(api, by_revision, push)
        for reason in reasons:
            decision.block(reason)
        if len(decision.fixes) > MAX_FIXES:
            decision.block(
                f"{len(decision.fixes)} distinct fixes need cherry-picking (maximum {MAX_FIXES})"
            )

    if decision.verdict != "blocked" and decision.fixes:
        decision.verdict = "needs-fixes"
    return decision


def build_payload(api, decision):
    actions = [
        {
            "action": "merge-onto",
            "target": decision.backstop["git_revision"],
            "commit_message": COMMIT_MESSAGE,
            "strategy": None,
        }
    ]
    for fix in decision.fixes:
        try:
            patch = fetch_patch(api, fix.git_revision)
        except MergeError as exc:
            decision.block(str(exc))
            continue
        actions.append(
            {"action": "add-commit-base64", "content": base64.b64encode(patch).decode("ascii")}
        )
    return None if decision.verdict == "blocked" else {"actions": actions}


def wait_for_job(api, job_id, sleep=time.sleep, clock=time.monotonic):
    deadline = clock() + LANDO_TIMEOUT
    while True:
        status = lando_job_status(api, job_id)
        state = status.get("status")
        logger.info("Lando job %s status: %s", job_id, state)
        if state in LANDO_TERMINAL_OK or state in LANDO_TERMINAL_FAILED:
            return status
        if clock() >= deadline:
            raise MergeError(f"Timed out waiting for Lando job {job_id} (last status {state})")
        sleep(LANDO_POLL_INTERVAL)


def format_report(decision, dry_run, lando_body=None, lando_url=None):
    backstop = decision.backstop
    lines = [
        f"Backstop push {backstop['push_id']}: hg {backstop['hg_revision']} "
        f"/ git {backstop['git_revision']}",
        f"  {backstop['treeherder_url']}",
    ]
    if not backstop["complete"]:
        lines.append("  Still has unfinished jobs.")
    if decision.already_merged:
        lines.append(f"  Already merged into {MAIN}.")
    lines.append(f"Verdict: {decision.verdict}")
    lines.extend(f"  - {reason}" for reason in decision.reasons)
    if decision.failure_counts:
        lines.append("Sheriffed failures by classification:")
        lines.extend(f"  {n}: {c}" for n, c in sorted(decision.failure_counts.items()))
    if decision.blocking_jobs:
        lines.append("Blocking jobs:")
        for job in decision.blocking_jobs:
            name = CLASSIFICATION_NAMES.get(job.failure_classification_id)
            lines.append(f"  {job.job_type_name} ({job.result}, {name}, task {job.task_id})")
    if decision.fixes:
        lines.append("Fixes to cherry-pick, in order:")
        for fix in decision.fixes:
            lines.append(
                f"  hg {fix.hg_revision} / git {fix.git_revision} "
                f"(push {fix.push_id}) {fix.subject}"
            )
            lines.extend(f"      fixes {job}" for job in sorted(set(fix.jobs)))
    if decision.verdict != "blocked" and not decision.already_merged:
        suffix = " (dry run, not submitted)" if dry_run else ""
        lines.append(
            f"Lando job{suffix}: merge-onto {backstop['git_revision']} "
            f"with {len(decision.fixes)} cherry-pick(s)"
        )
    if lando_body is not None:
        lines.append(f"Request body for POST {lando_url} (dry run, not submitted):")
        lines.append(json.dumps(lando_body, indent=2))
    if decision.lando_job:
        lines.append(f"Lando job: {json.dumps(decision.lando_job)}")
    return "\n".join(lines)


def redact_body(body, decision):
    actions = [body["actions"][0]]
    for action, fix in zip(body["actions"][1:], decision.fixes, strict=True):
        size = len(base64.b64decode(action["content"]))
        actions.append({**action, "content": f"<{size}-byte patch for {fix.git_revision}>"})
    return {**body, "actions": actions}


def output(decision, args, out, api=None, lando_body=None):
    lando_url = None
    if lando_body is not None:
        lando_url = lando_submit_url(api)
        lando_body = redact_body(lando_body, decision)
    if args.json:
        data = {**asdict(decision), "dry_run": not args.push}
        if lando_body is not None:
            data["lando_request"] = {"url": lando_url, "body": lando_body}
        out.write(json.dumps(data, indent=2) + "\n")
    else:
        out.write(format_report(decision, not args.push, lando_body, lando_url) + "\n")


def is_merge_commit(commit):
    return commit.subject.startswith("Merge ")


def autoland_origin(api, revision, before):
    found = pushes_containing(api, AUTOLAND, revision)
    candidates = [p for p in found if p.push_timestamp <= before]
    return min(candidates, key=lambda p: p.id) if candidates else None


def inspect_main_push(api, push):
    merge_commit = None
    picks = []
    for commit in push.commits:
        if is_merge_commit(commit):
            merge_commit = commit.revision
            continue
        origin = autoland_origin(api, commit.revision, push.push_timestamp)
        if origin is not None:
            return origin, commit.revision, merge_commit, picks
        picks.append(commit)
        if len(picks) > MAX_SAME_PUSH_CHERRY_PICKS:
            break
    return None, None, merge_commit, picks


def following_cherry_pick_pushes(api, merge_push):
    result = []
    for push in pushes_after(api, MAIN, merge_push.id):
        if push.author in IGNORED_MAIN_PUSH_AUTHORS:
            continue
        target, _, merge_commit, picks = inspect_main_push(api, push)
        if target is not None or merge_commit is not None:
            break
        if push.revision_count > MAX_SAME_PUSH_CHERRY_PICKS:
            logger.warning(
                "Ignoring %s push %s: %s commits not from autoland is too many to be cherry-picks",
                MAIN,
                push.id,
                push.revision_count,
            )
            continue
        result.append((push, picks))
    return result


def find_original(api, commit, after_push_id, before):
    for push in pushes_after(api, AUTOLAND, after_push_id, until=before):
        for candidate in push.commits:
            if candidate.author == commit.author and candidate.subject == commit.subject:
                return push, candidate.revision
    return None, None


def reconstruct(api, merge_push):
    target, _, merge_commit, same_push_picks = inspect_main_push(api, merge_push)
    if target is None:
        return None
    pick_pushes = [(merge_push, same_push_picks)] if same_push_picks else []
    pick_pushes.extend(following_cherry_pick_pushes(api, merge_push))
    cherry_picks = []
    for push, picks in pick_pushes:
        for commit in reversed(picks):
            original_push, original = find_original(api, commit, target.id, push.push_timestamp)
            cherry_picks.append(
                {
                    "main_push_id": push.id,
                    "hg_revision": commit.revision,
                    "author": commit.author,
                    "subject": commit.subject,
                    "same_push_as_merge": push.id == merge_push.id,
                    "original_hg_revision": original,
                    "original_push_id": original_push.id if original_push else None,
                }
            )
    pushed_at = datetime.fromtimestamp(merge_push.push_timestamp, UTC)
    return {
        "main_push_id": merge_push.id,
        "author": merge_push.author,
        "pushed_at": pushed_at.strftime("%Y-%m-%d %H:%M UTC"),
        "treeherder_url": push_url(api, MAIN, merge_push),
        "merge_commit": merge_commit,
        "target_push_id": target.id,
        "cherry_picks": cherry_picks,
    }


@dataclass
class Comparison:
    push: Push
    decision: Decision
    actual: dict | None
    skip_reason: str | None = None
    differences: list[str] = field(default_factory=list)


def differences(decision, actual):
    found = []
    if decision.verdict == "blocked":
        found.append("sheriffs merged it, but the script would have blocked it")
    script_fixes = {f.hg_revision for f in decision.fixes}
    originals = set()
    for pick in actual["cherry_picks"]:
        original = pick["original_hg_revision"]
        if original is None:
            found.append(
                f"sheriffs cherry-picked {pick['hg_revision'][:12]}, which has no matching "
                f"autoland commit: {pick['subject']}"
            )
            continue
        originals.add(original)
        if original not in script_fixes:
            found.append(
                f"sheriffs cherry-picked {original[:12]} but the script would not: "
                f"{pick['subject']}"
            )
    for fix in decision.fixes:
        if fix.hg_revision not in originals:
            found.append(
                f"the script would cherry-pick {fix.hg_revision[:12]} but sheriffs did not: "
                f"{fix.subject}"
            )
    return found


def compare_one(api, push, jobs):
    merge_push = main_push_containing(api, push.revision)
    actual = reconstruct(api, merge_push) if merge_push else None
    comparison = Comparison(push, decide(api, push, jobs), actual)
    if actual is None:
        comparison.skip_reason = f"not merged into {MAIN} yet"
    elif actual["target_push_id"] != push.id:
        comparison.skip_reason = f"merged as part of later autoland push {actual['target_push_id']}"
    else:
        comparison.differences = differences(comparison.decision, actual)
    return comparison


def collect_comparisons(args, api):
    if args.backstop:
        return [compare_one(api, *load_backstop(api, args.backstop))]
    wanted = args.last_backstops
    lookback = max(LATEST_BACKSTOP_LOOKBACK, wanted * PUSHES_PER_COMPARISON_LOOKBACK)
    comparisons = []
    useful = 0
    for push, jobs in iter_completed_backstops(api, lookback):
        logger.info("Comparing backstop %s (autoland push %s)", push.revision[:12], push.id)
        comparisons.append(compare_one(api, push, jobs))
        if comparisons[-1].skip_reason is None:
            useful += 1
            if useful == wanted:
                break
    if useful < wanted:
        logger.warning("Only found %s useful comparison(s) in the last %s pushes", useful, lookback)
    return list(reversed(comparisons))


def describe_pick(pick):
    original = pick["original_hg_revision"]
    source = f"{original[:12]} (autoland push {pick['original_push_id']})" if original else "?"
    where = "the merge push" if pick["same_push_as_merge"] else f"push {pick['main_push_id']}"
    return f"{source} as {pick['hg_revision'][:12]} in {where}: {pick['subject']}"


def format_comparison(comparison):
    push, decision, actual = comparison.push, comparison.decision, comparison.actual
    lines = [
        f"Backstop {push.revision[:12]} (autoland push {push.id})",
        f"  {decision.backstop['treeherder_url']}",
    ]
    if not decision.backstop["complete"]:
        lines.append("  Still has unfinished jobs.")
    lines.append(f"  Script: {decision.verdict}")
    lines.extend(f"    - {reason}" for reason in decision.reasons)
    lines.extend(
        f"    cherry-pick {f.hg_revision[:12]} (push {f.push_id}): {f.subject}"
        for f in decision.fixes
    )
    if actual is not None:
        how = (
            f"merge commit {actual['merge_commit'][:12]}"
            if actual["merge_commit"]
            else "fast-forward"
        )
        lines.append(
            f"  Sheriffs: {MAIN} push {actual['main_push_id']} by {actual['author']} "
            f"at {actual['pushed_at']} ({how})"
        )
        lines.append(f"    {actual['treeherder_url']}")
        lines.extend(f"    cherry-picked {describe_pick(p)}" for p in actual["cherry_picks"])
    if comparison.skip_reason:
        lines.append(f"  Not compared: {comparison.skip_reason}")
    else:
        result = "differs from sheriffs" if comparison.differences else "matches sheriffs"
        lines.append(f"  Result: {decision.verdict}, {result}")
        lines.extend(f"    - {difference}" for difference in comparison.differences)
    return "\n".join(lines)


def format_summary(useful, skipped):
    lines = [f"{len(useful)} compared, {len(skipped)} skipped"]
    for verdict in ("clean", "needs-fixes", "blocked"):
        group = [c for c in useful if c.decision.verdict == verdict]
        if group:
            differ = sum(1 for c in group if c.differences)
            lines.append(f"  {verdict}: {len(group) - differ} match, {differ} differ")
    return "\n".join(lines)


def run_compare(args, api, out):
    comparisons = collect_comparisons(args, api)
    useful = [c for c in comparisons if c.skip_reason is None]
    skipped = [c for c in comparisons if c.skip_reason is not None]
    if args.prefetch:
        out.write(
            f"Prefetched data for {len(useful)} compared and {len(skipped)} skipped backstop(s)\n"
        )
        return EXIT_OK
    if args.backstop:
        blocks = [format_comparison(c) for c in comparisons]
    else:
        blocks = [format_comparison(c) for c in useful]
        if skipped:
            blocks.append(
                "Skipped:\n"
                + "\n".join(
                    f"  {c.push.revision[:12]} (autoland push {c.push.id}): {c.skip_reason}"
                    for c in skipped
                )
            )
    blocks.append(format_summary(useful, skipped))
    out.write("\n\n".join(blocks) + "\n")
    return EXIT_MISMATCH if any(c.differences for c in useful) else EXIT_OK


def run(args, api, out=sys.stdout, sleep=time.sleep):
    if args.compare:
        if args.push:
            raise MergeError("--compare cannot be combined with --push")
        if bool(args.backstop) == bool(args.last_backstops):
            raise MergeError("--compare needs exactly one of --backstop or --last-backstops")
        if args.prefetch and not args.cache_dir:
            raise MergeError("--prefetch requires --cache-dir")
        if args.json:
            raise MergeError("--compare output is text only; --json is not supported")
        api.cache_dir = args.cache_dir
        return run_compare(args, api, out)
    if args.last_backstops or args.cache_dir or args.prefetch:
        raise MergeError(
            "--last-backstops, --cache-dir and --prefetch are only valid with --compare"
        )
    if args.push and not api.lando_token:
        raise MergeError("--push requires LANDO_HEADLESS_API_TOKEN")

    if args.backstop:
        push, jobs = load_backstop(api, args.backstop)
    else:
        push, jobs = latest_completed_backstop(api)
    decision = decide(api, push, jobs)
    decision.already_merged = main_push_containing(api, push.revision) is not None

    if decision.already_merged:
        output(decision, args, out)
        return EXIT_NOTHING_TO_DO
    if args.push and not decision.backstop["complete"]:
        decision.block("the backstop still has unfinished jobs")
    body = build_payload(api, decision) if decision.verdict != "blocked" else None
    if body is None:
        output(decision, args, out)
        return EXIT_NOT_MERGEABLE
    if not args.push:
        output(decision, args, out, api=api, lando_body=body)
        return EXIT_OK

    submitted = lando_submit(api, body)
    job_id = submitted.get("job_id", submitted.get("id"))
    logger.info("Submitted Lando job %s: %s", job_id, submitted.get("status_url"))
    decision.lando_job = wait_for_job(api, job_id, sleep=sleep)
    output(decision, args, out)
    return EXIT_OK if decision.lando_job.get("status") in LANDO_TERMINAL_OK else EXIT_ERROR


def revision(value):
    value = value.lower()
    if not REVISION_RE.fullmatch(value):
        raise argparse.ArgumentTypeError(f"{value} is not a 12-40 character hg revision")
    return value


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError(f"{value} is not a positive integer")
    return number


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Merge the latest completed autoland backstop push into firefox-main."
    )
    parser.add_argument("--push", action="store_true", help="submit the merge to Lando")
    parser.add_argument(
        "--backstop",
        type=revision,
        help="evaluate the autoland backstop push with this tip hg revision",
    )
    parser.add_argument("--json", action="store_true", help="print the decision as JSON")
    parser.add_argument(
        "--compare",
        action="store_true",
        help="compare the script's decision with what sheriffs actually did",
    )
    parser.add_argument(
        "--last-backstops",
        type=positive_int,
        metavar="N",
        help="with --compare: compare the N most recent backstops that sheriffs merged directly",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        help="with --compare: store fetched data here and replay it on later runs",
    )
    parser.add_argument(
        "--prefetch",
        action="store_true",
        help="with --compare and --cache-dir: fill the cache without printing comparisons",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", stream=sys.stderr)
    config = Config(lando_url=os.environ.get("LANDO_URL", Config.lando_url))
    api = Api(config=config, lando_token=os.environ.get("LANDO_HEADLESS_API_TOKEN"))
    try:
        return run(args, api)
    except (MergeError, requests.RequestException) as exc:
        logger.error("%s", exc)
        return EXIT_ERROR


if __name__ == "__main__":
    sys.exit(main())
