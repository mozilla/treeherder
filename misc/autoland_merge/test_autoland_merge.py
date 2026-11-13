import base64
import hashlib
import io
import json
import re
from urllib.parse import parse_qs, urlparse

import pytest
import responses

import autoland_merge as am

TH = "https://treeherder.mozilla.org/api/project/autoland"
TH_MAIN = "https://treeherder.mozilla.org/api/project/mozilla-central"
TC = "https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task"
LANDO = "https://lando.moz.tools/api"
GH = "https://github.com/mozilla-firefox/firefox/commit"
DEV = "Dev <dev@example.com>"
MERGE_TS = 2000


def rev(n):
    return hashlib.sha1(str(n).encode()).hexdigest()


def git(hg):
    return "9" + hg[1:]


def make_patch(sha, subject):
    return (
        f"From {sha} Mon Sep 17 00:00:00 2001\n"
        f"From: Someone <someone@example.com>\n"
        f"Date: Wed, 11 Nov 2026 19:05:38 +0200\n"
        f"Subject: [PATCH] {subject}\n\n---\n diff\n"
    ).encode()


def job(
    job_id,
    result="success",
    classification=1,
    tier=1,
    state="completed",
    task_id=None,
    name=None,
):
    return {
        "id": job_id,
        "task_id": task_id or f"task{job_id}",
        "job_type_name": name or f"job-{job_id}",
        "result": result,
        "state": state,
        "tier": tier,
        "failure_classification_id": classification,
    }


def note(task_id, text, classification="fixed by commit", created="2026-11-11T10:00:00"):
    return {
        "job": {"task_id": task_id},
        "failure_classification_name": classification,
        "text": text,
        "created": created,
    }


def push_data(push_id, commits, timestamp, author):
    return {
        "id": push_id,
        "revision": commits[0][0],
        "revisions": [
            {"revision": r, "author": a, "comments": f"{subject}\n\nDifferential Revision: x"}
            for r, a, subject in commits
        ],
        "revision_count": len(commits),
        "push_timestamp": timestamp,
        "author": author,
    }


class World:
    def __init__(self, rsps):
        self.rsps = rsps
        self.pushes = {}
        self.main_pushes = {}
        self.decision = {}
        self.backstops = set()
        self.jobs = {}
        self.notes = {}
        self.patches = {}
        self.lando_statuses = ["LANDED"]
        self.submitted = []
        self._register()

    def add_push(
        self, push_id, revisions, backstop=False, jobs=None, decision=True, timestamp=None
    ):
        commits = [
            r if isinstance(r, tuple) else (r, DEV, f"Bug {push_id} - commit {r[-4:]}")
            for r in revisions
        ]
        self.pushes[push_id] = push_data(
            push_id, commits, timestamp if timestamp is not None else push_id * 100, DEV
        )
        if decision:
            self.decision[push_id] = f"decision{push_id}"
        if backstop:
            self.backstops.add(f"decision{push_id}")
        self.jobs[push_id] = jobs if jobs is not None else [job(push_id * 100)]
        for r, _, subject in commits:
            self.patches.setdefault(git(r), make_patch(git(r), subject))

    def add_main_push(self, push_id, commits, timestamp, author="sheriff@mozilla.com"):
        self.main_pushes[push_id] = push_data(push_id, commits, timestamp, author)

    def mark_merged(self, revision):
        self.add_main_push(900, [(revision, DEV, "merged")], 10**9)

    def commit_of(self, revision):
        for push in self.pushes.values():
            for c in push["revisions"]:
                if c["revision"] == revision:
                    return (revision, c["author"], c["comments"].splitlines()[0])
        raise KeyError(revision)

    def _filter_pushes(self, request, source):
        q = {k: v[0] for k, v in parse_qs(urlparse(request.url).query).items()}
        pushes = sorted(source.values(), key=lambda p: -p["id"])
        if "id" in q:
            pushes = [p for p in pushes if p["id"] == int(q["id"])]
        if "id__lt" in q:
            pushes = [p for p in pushes if p["id"] < int(q["id__lt"])]
        if "revision" in q:
            pushes = [p for p in pushes if p["revision"].startswith(q["revision"])]
        if "id__gt" in q:
            pushes = [p for p in pushes if p["id"] > int(q["id__gt"])]
        if "push_timestamp__lte" in q:
            pushes = [p for p in pushes if p["push_timestamp"] <= int(q["push_timestamp__lte"])]
        if "commit_revision" in q:
            pushes = [
                p
                for p in pushes
                if any(r["revision"] == q["commit_revision"] for r in p["revisions"])
            ]
        pushes = pushes[: int(q.get("count", 10))]
        return 200, {}, json.dumps({"results": pushes})

    def _decision(self, request):
        ids = parse_qs(urlparse(request.url).query)["push_ids"][0].split(",")
        found = {i: {"id": self.decision[int(i)], "run": 0} for i in ids if int(i) in self.decision}
        if not found:
            return 404, {}, json.dumps("No decision tasks found")
        return 200, {}, json.dumps(found)

    def _params(self, request):
        task_id = request.url.split("/task/")[1].split("/")[0]
        backstop = "true" if task_id in self.backstops else "false"
        return 200, {}, f"backstop: {backstop}\nproject: autoland\n"

    def _jobs(self, request):
        q = parse_qs(urlparse(request.url).query)
        push_id = int(q["push_id"][0])
        offset = int(q["offset"][0])
        count = int(q["count"][0])
        return 200, {}, json.dumps({"results": self.jobs[push_id][offset : offset + count]})

    def _notes(self, request):
        revision = parse_qs(urlparse(request.url).query)["revision"][0]
        return 200, {}, json.dumps(self.notes.get(revision, []))

    def _hg2git(self, request):
        hg = request.url.rsplit("/", 1)[1]
        return 200, {}, json.dumps({"git_hash": git(hg), "hg_hash": hg})

    def _patch(self, request):
        sha = request.url.rsplit("/", 1)[1].removesuffix(".patch")
        return 200, {}, self.patches[sha]

    def _submit(self, request):
        self.submitted.append(json.loads(request.body))
        return 202, {}, json.dumps({"job_id": 42, "status_url": f"{LANDO}/job/42"})

    def _job_status(self, request):
        status = (
            self.lando_statuses.pop(0) if len(self.lando_statuses) > 1 else self.lando_statuses[0]
        )
        return 200, {}, json.dumps({"job_id": 42, "status": status, "message": "", "error": ""})

    def _register(self):
        cb = self.rsps.add_callback
        cb(responses.GET, re.compile(re.escape(f"{TH}/push/decisiontask/")), self._decision)
        cb(
            responses.GET,
            re.compile(re.escape(f"{TH}/push/") + r"(\?.*)?$"),
            lambda r: self._filter_pushes(r, self.pushes),
        )
        cb(
            responses.GET,
            re.compile(re.escape(f"{TH_MAIN}/push/") + r"(\?.*)?$"),
            lambda r: self._filter_pushes(r, self.main_pushes),
        )
        cb(responses.GET, re.compile(re.escape(f"{TH}/jobs/")), self._jobs)
        cb(responses.GET, re.compile(re.escape(f"{TH}/note/push_notes/")), self._notes)
        cb(responses.GET, re.compile(re.escape(TC) + r"/.*/parameters\.yml"), self._params)
        cb(responses.GET, re.compile(re.escape(f"{LANDO}/hg2git/firefox/") + ".*"), self._hg2git)
        cb(responses.GET, re.compile(re.escape(GH) + r"/.*\.patch"), self._patch)
        cb(responses.POST, f"{LANDO}/repo/firefox-main", self._submit)
        cb(responses.GET, re.compile(re.escape(f"{LANDO}/job/") + r"\d+"), self._job_status)


@pytest.fixture
def world():
    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        yield World(rsps)


def run(argv, token="secret"):
    args = am.parse_args(argv)
    out = io.StringIO()
    code = am.run(args, am.Api(lando_token=token), out=out, sleep=lambda _: None)
    return code, out.getvalue()


def run_json(argv, token="secret"):
    code, out = run([*argv, "--json"], token=token)
    return code, json.loads(out)


def build_history(world, backstop_jobs, backstop_id=10):
    world.add_push(backstop_id - 1, [rev(90)])
    world.add_push(backstop_id, [rev(100), rev(99)], backstop=True, jobs=backstop_jobs)
    for i in range(1, 6):
        world.add_push(backstop_id + i, [rev(100 + i * 10), rev(100 + i * 10 - 1)])


def fix_setup(world, fix_revisions):
    jobs = []
    notes = []
    for i, fix_rev in enumerate(fix_revisions):
        task = f"T{i}"
        jobs.append(job(i + 1, "testfailed", 2, task_id=task, name=f"broken-{i}"))
        notes.append(note(task, fix_rev))
    build_history(world, jobs)
    world.notes[rev(100)] = notes


def test_classify_buckets_sheriffed_failures():
    jobs = [
        am.Job.from_api(job(1, "testfailed", 4)),
        am.Job.from_api(job(2, "busted", 5)),
        am.Job.from_api(job(3, "exception", 7)),
        am.Job.from_api(job(4, "testfailed", 8)),
        am.Job.from_api(job(5, "testfailed", 3)),
        am.Job.from_api(job(6, "testfailed", 1)),
        am.Job.from_api(job(7, "testfailed", 6)),
        am.Job.from_api(job(8, "testfailed", 2)),
        am.Job.from_api(job(9, "testfailed", 1, tier=3)),
        am.Job.from_api(job(10, "retry", 1)),
        am.Job.from_api(job(11, "superseded", 1)),
        am.Job.from_api(job(12, "success", 1)),
    ]
    counts, unclassified, fixed = am.classify(jobs)
    assert [j.id for j in unclassified] == [6, 7]
    assert [j.id for j in fixed] == [8]
    assert counts == {
        "intermittent": 1,
        "infra": 1,
        "autoclassified intermittent": 1,
        "intermittent needs bugid": 1,
        "expected fail": 1,
        "not classified": 1,
        "new failure not classified": 1,
        "fixed by commit": 1,
    }


@pytest.mark.parametrize(
    "text,expected",
    [
        (rev(5), rev(5)),
        (f"fixed by https://hg.mozilla.org/integration/autoland/rev/{rev(7)} thanks", rev(7)),
        (
            "Fixed by B6F138DF05331E42781ED5716B225E23030ECE02",
            "b6f138df05331e42781ed5716b225e23030ece02",
        ),
        ("b6f138df0533", None),
        ("bug 123456", None),
        ("", None),
        ("a" * 41, None),
    ],
)
def test_parse_fix_revision(text, expected):
    assert am.parse_fix_revision(text) == expected


def test_extract_fixes_uses_newest_fixed_by_commit_note():
    jobs = [am.Job.from_api(job(1, "testfailed", 2, task_id="A", name="a"))]
    notes = [
        note("A", rev(1), created="2026-11-11T10:00:00"),
        note("A", rev(2), created="2026-11-11T12:00:00"),
        note("A", rev(3), classification="intermittent", created="2026-11-11T13:00:00"),
    ]
    fixes, unresolved = am.extract_fixes(jobs, notes)
    assert fixes == {rev(2): ["a"]}
    assert unresolved == []


def test_clean_merge_dry_run_does_not_post(world):
    build_history(world, [job(1, "testfailed", 4), job(2, "success")])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert data["verdict"] == "clean"
    assert data["dry_run"] is True
    assert data["backstop"]["push_id"] == 10
    assert data["backstop"]["git_revision"] == git(rev(100))
    assert world.submitted == []


def test_text_report_shows_dry_run(world):
    build_history(world, [job(1, "testfailed", 4)])
    code, out = run([])
    assert code == am.EXIT_OK
    assert "Verdict: clean" in out
    assert "dry run, not submitted" in out


def test_dry_run_includes_lando_request_body(world):
    fix_setup(world, [rev(130), rev(120)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    request = data["lando_request"]
    assert request["url"] == f"{LANDO}/repo/firefox-main"
    actions = request["body"]["actions"]
    assert actions[0] == {
        "action": "merge-onto",
        "target": git(rev(100)),
        "commit_message": am.COMMIT_MESSAGE,
        "strategy": None,
    }
    assert actions[1:] == [
        {
            "action": "add-commit-base64",
            "content": f"<{len(world.patches[git(r)])}-byte patch for {git(r)}>",
        }
        for r in (rev(120), rev(130))
    ]
    assert world.submitted == []


def test_dry_run_text_report_includes_request_body(world):
    build_history(world, [job(1, "testfailed", 4)])
    code, out = run([])
    heading = f"Request body for POST {LANDO}/repo/firefox-main (dry run, not submitted):\n"
    assert heading in out
    assert json.loads(out.split(heading, 1)[1]) == {
        "actions": [
            {
                "action": "merge-onto",
                "target": git(rev(100)),
                "commit_message": am.COMMIT_MESSAGE,
                "strategy": None,
            }
        ]
    }


def test_dry_run_body_matches_pushed_body_apart_from_patch_content(world):
    fix_setup(world, [rev(120)])
    _, dry = run_json([])
    code, _ = run_json(["--push"])
    assert code == am.EXIT_OK
    [submitted] = world.submitted
    dry_actions = dry["lando_request"]["body"]["actions"]
    assert submitted["actions"][0] == dry_actions[0]
    assert [a["action"] for a in submitted["actions"]] == [a["action"] for a in dry_actions]
    assert base64.b64decode(submitted["actions"][1]["content"]) == world.patches[git(rev(120))]
    assert dry_actions[1]["content"] == (
        f"<{len(world.patches[git(rev(120))])}-byte patch for {git(rev(120))}>"
    )


@pytest.mark.parametrize("merged", [True, False])
def test_no_request_body_when_nothing_would_be_submitted(world, merged):
    build_history(world, [job(1, "testfailed", 4 if merged else 1)])
    if merged:
        world.mark_merged(rev(100))
    code, data = run_json([])
    assert "lando_request" not in data
    code, out = run([])
    assert "Request body" not in out


def test_push_output_has_no_request_body(world):
    build_history(world, [job(1)])
    code, data = run_json(["--push"])
    assert "lando_request" not in data


def test_unclassified_failure_blocks(world):
    build_history(world, [job(1, "testfailed", 1, name="bad"), job(2, "testfailed", 4)])
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE
    assert data["verdict"] == "blocked"
    assert [j["job_type_name"] for j in data["blocking_jobs"]] == ["bad"]


def test_new_failure_not_classified_blocks(world):
    build_history(world, [job(1, "busted", 6)])
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE


def test_tier3_and_retry_failures_are_ignored(world):
    build_history(world, [job(1, "testfailed", 1, tier=3), job(2, "retry", 1)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert data["verdict"] == "clean"


def test_shared_fix_counts_once_and_is_ordered(world):
    fix_setup(world, [rev(140), rev(120), rev(140), rev(119)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert data["verdict"] == "needs-fixes"
    assert [f["hg_revision"] for f in data["fixes"]] == [rev(119), rev(120), rev(140)]
    assert [f["git_revision"] for f in data["fixes"]] == [
        git(rev(119)),
        git(rev(120)),
        git(rev(140)),
    ]
    assert sorted(data["fixes"][2]["jobs"]) == ["broken-0", "broken-2"]
    assert data["fixes"][0]["subject"] == f"Bug 12 - commit {rev(119)[-4:]}"


def test_four_fixes_allowed(world):
    fix_setup(world, [rev(110), rev(120), rev(130), rev(140)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert len(data["fixes"]) == 4


def test_five_fixes_blocked(world):
    fix_setup(world, [rev(110), rev(120), rev(130), rev(140), rev(150)])
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE
    assert any("5 distinct fixes" in r for r in data["reasons"])


def test_short_hash_note_blocks(world):
    fix_setup(world, [rev(120)[:12]])
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE
    assert any("no note with a full commit revision" in r for r in data["reasons"])


def test_fix_already_in_backstop_is_dropped(world):
    fix_setup(world, [rev(99), rev(90), rev(120)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert [f["hg_revision"] for f in data["fixes"]] == [rev(120)]


def test_unknown_fix_revision_blocks(world):
    fix_setup(world, [rev(999)])
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE
    assert any("was not found" in r for r in data["reasons"])


@pytest.mark.parametrize(
    "patch",
    [
        make_patch(git(rev(120)), "a") + make_patch(git(rev(121)), "b"),
        make_patch(git(rev(121)), "other commit"),
        b"",
    ],
)
def test_fix_that_is_not_a_single_commit_blocks(world, patch):
    fix_setup(world, [rev(120)])
    world.patches[git(rev(120))] = patch
    code, data = run_json([])
    assert code == am.EXIT_NOT_MERGEABLE
    assert any("not a single non-merge commit" in r for r in data["reasons"])


def test_incomplete_newest_backstop_falls_back(world):
    world.add_push(5, [rev(50)], backstop=True, jobs=[job(1, "testfailed", 4)])
    world.add_push(6, [rev(60)])
    world.add_push(7, [rev(70)], backstop=True, jobs=[job(2, state="running"), job(3)])
    world.add_push(8, [rev(80)], decision=False)
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert data["backstop"]["push_id"] == 5


@pytest.mark.parametrize("state", ["pending", "running"])
def test_pending_or_running_jobs_mean_incomplete(world, state):
    world.add_push(5, [rev(50)], backstop=True)
    world.add_push(7, [rev(70)], backstop=True, jobs=[job(2), job(3, state=state)])
    code, data = run_json([])
    assert data["backstop"]["push_id"] == 5


def test_unscheduled_jobs_do_not_make_a_push_incomplete(world):
    world.add_push(5, [rev(50)], backstop=True)
    world.add_push(7, [rev(70)], backstop=True, jobs=[job(2), job(3, state="unscheduled")])
    code, data = run_json([])
    assert data["backstop"]["push_id"] == 7
    assert data["backstop"]["complete"] is True


def test_lookback_pages_through_pushes(world):
    world.add_push(1, [rev(1)], backstop=True)
    for i in range(2, 120):
        world.add_push(i, [rev(i)])
    code, data = run_json([])
    assert code == am.EXIT_OK
    assert data["backstop"]["push_id"] == 1


def test_no_backstop_within_lookback(world):
    for i in range(1, 5):
        world.add_push(i, [rev(i)])
    with pytest.raises(am.MergeError, match="No completed backstop"):
        run([])


def test_already_merged_is_nothing_to_do(world):
    build_history(world, [job(1, "testfailed", 1)])
    world.mark_merged(rev(100))
    code, data = run_json([])
    assert code == am.EXIT_NOTHING_TO_DO
    assert data["already_merged"] is True
    assert data["verdict"] == "blocked"


def test_explicit_backstop_by_revision(world):
    build_history(world, [job(1, "testfailed", 4)])
    world.add_push(20, [rev(200)], backstop=True)
    code, data = run_json(["--backstop", rev(100)])
    assert code == am.EXIT_OK
    assert data["backstop"]["push_id"] == 10


def test_explicit_backstop_by_revision_prefix(world):
    build_history(world, [job(1, "testfailed", 4)])
    code, data = run_json(["--backstop", rev(100)[:12].upper()])
    assert code == am.EXIT_OK
    assert data["backstop"]["hg_revision"] == rev(100)


def test_explicit_backstop_must_be_a_push_tip(world):
    build_history(world, [job(1)])
    with pytest.raises(am.MergeError, match="No autoland push has tip revision"):
        run(["--backstop", rev(99)])


@pytest.mark.parametrize("value", ["10", "abc", "g" * 40, "a" * 41])
def test_explicit_backstop_must_look_like_a_revision(value):
    with pytest.raises(SystemExit):
        am.parse_args(["--backstop", value])


def test_explicit_backstop_already_merged_is_still_evaluated(world):
    fix_setup(world, [rev(120)])
    world.mark_merged(rev(100))
    code, data = run_json(["--backstop", rev(100)])
    assert code == am.EXIT_NOTHING_TO_DO
    assert data["already_merged"] is True
    assert data["verdict"] == "needs-fixes"
    assert [f["hg_revision"] for f in data["fixes"]] == [rev(120)]


def test_explicit_non_backstop_rejected(world):
    build_history(world, [job(1)])
    with pytest.raises(am.MergeError, match="not a backstop"):
        run(["--backstop", rev(110)])


def test_explicit_incomplete_backstop_is_assessed_but_not_pushed(world):
    build_history(world, [job(1, state="pending"), job(2, "testfailed", 4)])
    code, data = run_json(["--backstop", rev(100)])
    assert code == am.EXIT_OK
    assert data["backstop"]["complete"] is False
    assert data["verdict"] == "clean"
    code, data = run_json(["--backstop", rev(100), "--push"])
    assert code == am.EXIT_NOT_MERGEABLE
    assert "the backstop still has unfinished jobs" in data["reasons"]
    assert world.submitted == []


def test_explicit_backstop_can_be_pushed(world):
    build_history(world, [job(1)])
    code, _ = run(["--backstop", rev(100), "--push"])
    assert code == am.EXIT_OK
    assert len(world.submitted) == 1


def test_push_requires_token(world):
    build_history(world, [job(1)])
    with pytest.raises(am.MergeError):
        run(["--push"], token=None)
    assert world.submitted == []


def test_push_submits_single_job_with_merge_and_fixes(world):
    fix_setup(world, [rev(130), rev(120)])
    world.lando_statuses = ["SUBMITTED", "IN_PROGRESS", "DEFERRED", "LANDED"]
    code, data = run_json(["--push"])
    assert code == am.EXIT_OK
    assert data["dry_run"] is False
    assert data["lando_job"]["status"] == "LANDED"
    assert len(world.submitted) == 1
    actions = world.submitted[0]["actions"]
    assert actions[0] == {
        "action": "merge-onto",
        "target": git(rev(100)),
        "commit_message": am.COMMIT_MESSAGE,
        "strategy": None,
    }
    assert [a["action"] for a in actions[1:]] == ["add-commit-base64"] * 2
    assert [base64.b64decode(a["content"]) for a in actions[1:]] == [
        world.patches[git(rev(120))],
        world.patches[git(rev(130))],
    ]


def test_push_reports_lando_failure(world):
    build_history(world, [job(1)])
    world.lando_statuses = ["IN_PROGRESS", "FAILED"]
    code, data = run_json(["--push"])
    assert code == am.EXIT_ERROR
    assert data["lando_job"]["status"] == "FAILED"


def test_push_not_submitted_when_blocked(world):
    build_history(world, [job(1, "testfailed", 1)])
    code, _ = run(["--push"])
    assert code == am.EXIT_NOT_MERGEABLE
    assert world.submitted == []


def test_push_not_submitted_when_already_merged(world):
    build_history(world, [job(1)])
    world.mark_merged(rev(100))
    code, _ = run(["--push"])
    assert code == am.EXIT_NOTHING_TO_DO
    assert world.submitted == []


def test_wait_for_job_times_out(monkeypatch):
    monkeypatch.setattr(am, "lando_job_status", lambda api, job_id: {"status": "IN_PROGRESS"})
    now = [0.0]

    def sleep(seconds):
        now[0] += seconds

    with pytest.raises(am.MergeError, match="Timed out"):
        am.wait_for_job(am.Api(), 1, sleep=sleep, clock=lambda: now[0])
    assert now[0] >= am.LANDO_TIMEOUT


def test_json_output_shape(world):
    fix_setup(world, [rev(120)])
    code, data = run_json([])
    assert set(data) == {
        "backstop",
        "already_merged",
        "verdict",
        "reasons",
        "failure_counts",
        "blocking_jobs",
        "fixes",
        "lando_job",
        "dry_run",
        "lando_request",
    }
    assert set(data["backstop"]) == {
        "push_id",
        "hg_revision",
        "git_revision",
        "complete",
        "treeherder_url",
    }
    assert set(data["fixes"][0]) == {
        "hg_revision",
        "push_id",
        "position",
        "subject",
        "jobs",
        "git_revision",
    }


def test_config_urls_are_used(world):
    config = am.Config(treeherder_url="https://th.example", lando_url="https://lando.example")
    api = am.Api(config=config)
    world.rsps.add(
        responses.GET,
        "https://th.example/api/project/autoland/push/",
        json={"results": []},
    )
    assert am.pushes(api, am.AUTOLAND, {}) == []
    assert am.push_url(api, am.AUTOLAND, am.Push(1, rev(1), [], 1)).startswith(
        "https://th.example/"
    )


def cherry_pick_of(world, original, pick_revision):
    _, author, subject = world.commit_of(original)
    return (pick_revision, author, subject)


def merged_history(world, backstop_jobs=None, notes=None, picks=()):
    build_history(world, backstop_jobs or [job(1, "testfailed", 4)])
    if notes:
        world.notes[rev(100)] = notes
    merged = [(r, DEV, f"Bug 10 - commit {r[-4:]}") for r in (rev(100), rev(99))]
    merged.append((rev(90), DEV, f"Bug 9 - commit {rev(90)[-4:]}"))
    world.add_main_push(500, merged, MERGE_TS)
    pick_commits = [
        cherry_pick_of(world, original, rev(6000 + i)) for i, original in enumerate(picks)
    ]
    for i, commit in enumerate(pick_commits):
        world.add_main_push(501 + i, [commit], MERGE_TS + 100 + i)
    if pick_commits:
        world.add_push(16, list(reversed(pick_commits)), timestamp=MERGE_TS + 500)
    return pick_commits


def fixed_by(fix_revision, task="T0"):
    return [job(1, "testfailed", 2, task_id=task, name="broken")], [note(task, fix_revision)]


def compare(*argv):
    return am.collect_comparisons(am.parse_args(["--compare", *argv]), am.Api())


def compare_one_backstop(revision=None):
    [comparison] = compare("--backstop", revision or rev(100))
    return comparison


def test_compare_matches_on_clean_merge(world):
    merged_history(world)
    comparison = compare_one_backstop()
    assert comparison.skip_reason is None
    assert comparison.differences == []
    assert comparison.decision.verdict == "clean"
    assert comparison.actual["main_push_id"] == 500
    assert comparison.actual["merge_commit"] is None
    assert comparison.actual["cherry_picks"] == []
    code, out = run(["--compare", "--backstop", rev(100)])
    assert code == am.EXIT_OK
    assert "Result: clean, matches sheriffs" in out
    assert "Sheriffs: mozilla-central push 500 by sheriff@mozilla.com" in out
    assert out.rstrip().endswith("1 compared, 0 skipped\n  clean: 1 match, 0 differ")
    assert world.submitted == []


def test_compare_matches_on_cherry_pick(world):
    jobs, notes = fixed_by(rev(120))
    merged_history(world, jobs, notes, picks=[rev(120)])
    comparison = compare_one_backstop()
    assert comparison.decision.verdict == "needs-fixes"
    assert comparison.differences == []
    [pick] = comparison.actual["cherry_picks"]
    assert pick["hg_revision"] == rev(6000)
    assert pick["original_hg_revision"] == rev(120)
    assert pick["original_push_id"] == 12
    assert pick["main_push_id"] == 501
    assert pick["same_push_as_merge"] is False
    code, out = run(["--compare", "--backstop", rev(100)])
    assert "Result: needs-fixes, matches sheriffs" in out
    assert (
        f"cherry-picked {rev(120)[:12]} (autoland push 12) as {rev(6000)[:12]} in push 501" in out
    )


def test_compare_reports_cherry_pick_missing_from_script(world):
    jobs, notes = fixed_by(rev(120))
    merged_history(world, jobs, notes, picks=[rev(120), rev(130)])
    comparison = compare_one_backstop()
    assert len(comparison.differences) == 1
    assert comparison.differences[0].startswith(
        f"sheriffs cherry-picked {rev(130)[:12]} but the script would not"
    )
    code, out = run(["--compare", "--backstop", rev(100)])
    assert code == am.EXIT_MISMATCH
    assert "Result: needs-fixes, differs from sheriffs" in out
    assert "needs-fixes: 0 match, 1 differ" in out


def test_compare_reports_extra_script_cherry_pick(world):
    jobs, notes = fixed_by(rev(120))
    merged_history(world, jobs, notes)
    comparison = compare_one_backstop()
    assert [d.split(":")[0] for d in comparison.differences] == [
        f"the script would cherry-pick {rev(120)[:12]} but sheriffs did not"
    ]


def test_compare_unknown_original(world):
    merged_history(world)
    world.add_main_push(
        501, [(rev(7000), "Sheriff <s@mozilla.com>", "No bug - fix by hand")], MERGE_TS + 50
    )
    comparison = compare_one_backstop()
    assert comparison.differences == [
        f"sheriffs cherry-picked {rev(7000)[:12]}, which has no matching autoland commit: "
        "No bug - fix by hand"
    ]


def test_compare_sheriffs_merged_blocked_backstop(world):
    merged_history(world, [job(1, "testfailed", 1)])
    comparison = compare_one_backstop()
    assert comparison.decision.verdict == "blocked"
    assert comparison.differences == ["sheriffs merged it, but the script would have blocked it"]
    code, out = run(["--compare", "--backstop", rev(100)])
    assert code == am.EXIT_MISMATCH
    assert "Result: blocked, differs from sheriffs" in out
    assert "blocked: 0 match, 1 differ" in out


def test_compare_detects_merge_commit_and_same_push_picks(world):
    build_history(world, [job(1, "testfailed", 4)])
    pick = cherry_pick_of(world, rev(120), rev(6000))
    world.add_main_push(
        500,
        [
            pick,
            (rev(5000), "Lando <lando@lando.moz.tools>", "Merge autoland to mozilla-central"),
            (rev(100), DEV, "x"),
            (rev(99), DEV, "y"),
        ],
        MERGE_TS,
    )
    comparison = compare_one_backstop()
    assert comparison.actual["merge_commit"] == rev(5000)
    picks = comparison.actual["cherry_picks"]
    assert [(p["original_hg_revision"], p["same_push_as_merge"]) for p in picks] == [
        (rev(120), True)
    ]
    code, out = run(["--compare", "--backstop", rev(100)])
    assert f"(merge commit {rev(5000)[:12]})" in out
    assert "in the merge push" in out


def test_compare_stops_cherry_picks_at_next_merge(world):
    merged_history(world, picks=[rev(120)])
    world.add_main_push(600, [(rev(150), DEV, "z"), (rev(149), DEV, "w")], MERGE_TS + 300)
    world.add_main_push(601, [(rev(8000), DEV, "Bug 1 - later pick")], MERGE_TS + 400)
    picks = compare_one_backstop().actual["cherry_picks"]
    assert [p["hg_revision"] for p in picks] == [rev(6000)]


def test_compare_window_runs_until_next_merge_and_skips_automation(world):
    merged_history(world)
    world.add_main_push(
        501,
        [(rev(7001), "ffxbld", "No bug - Tagging")],
        MERGE_TS + 10,
        author="ffxbld@lando.moz.tools",
    )
    world.add_main_push(502, [(rev(7002), DEV, "Bug 2 - days later")], MERGE_TS + 5 * 86400)
    picks = compare_one_backstop().actual["cherry_picks"]
    assert [p["hg_revision"] for p in picks] == [rev(7002)]


def test_compare_pages_through_pushes(world, monkeypatch):
    monkeypatch.setattr(am, "MAX_PUSHES_PER_QUERY", 2)
    jobs = [job(i + 1, "testfailed", 2, task_id=f"T{i}") for i in range(3)]
    notes = [note(f"T{i}", r) for i, r in enumerate((rev(120), rev(130), rev(140)))]
    merged_history(world, jobs, notes, picks=[rev(120), rev(130), rev(140)])
    comparison = compare_one_backstop()
    assert comparison.differences == []
    picks = comparison.actual["cherry_picks"]
    assert [p["original_hg_revision"] for p in picks] == [rev(120), rev(130), rev(140)]
    assert [p["main_push_id"] for p in picks] == [501, 502, 503]


def test_compare_ignores_large_direct_push(world):
    merged_history(world)
    world.add_main_push(
        501, [(rev(7100 + i), DEV, f"Bug 3 - part {i}") for i in range(15)], MERGE_TS + 10
    )
    assert compare_one_backstop().actual["cherry_picks"] == []


def test_compare_backmerged_pick_is_not_mistaken_for_merge(world):
    jobs, notes = fixed_by(rev(120))
    picks = merged_history(world, jobs, notes, picks=[rev(120)])
    assert world.pushes[16]["revision"] == picks[0][0]
    comparison = compare_one_backstop()
    assert comparison.actual["main_push_id"] == 500
    assert comparison.actual["cherry_picks"][0]["main_push_id"] == 501


@pytest.mark.parametrize("classification", [4, 1])
def test_compare_not_merged_yet_is_skipped(world, classification):
    build_history(world, [job(1, "testfailed", classification)])
    comparison = compare_one_backstop()
    assert comparison.skip_reason == "not merged into mozilla-central yet"
    assert comparison.differences == []
    code, out = run(["--compare", "--backstop", rev(100)])
    assert code == am.EXIT_OK
    assert "Not compared: not merged into mozilla-central yet" in out
    assert "0 compared, 1 skipped" in out


def test_compare_merged_as_part_of_later_push_is_skipped(world):
    jobs, notes = fixed_by(rev(120))
    build_history(world, jobs)
    world.notes[rev(100)] = notes
    world.add_main_push(
        500, [(rev(130), DEV, "a"), (rev(129), DEV, "b"), (rev(100), DEV, "c")], MERGE_TS
    )
    comparison = compare_one_backstop()
    assert comparison.skip_reason == "merged as part of later autoland push 13"
    assert comparison.differences == []
    code, out = run(["--compare", "--backstop", rev(100)])
    assert code == am.EXIT_OK
    assert "Not compared: merged as part of later autoland push 13" in out


def test_compare_backstop_checks(world):
    build_history(world, [job(1, state="running")])
    with pytest.raises(am.MergeError, match="not a backstop"):
        compare("--backstop", rev(110))
    assert compare_one_backstop().decision.backstop["complete"] is False


def last_backstops_history(world):
    world.add_push(10, [rev(100)], backstop=True, jobs=[job(1, "testfailed", 4)])
    for i in range(11, 40):
        world.add_push(i, [rev(i * 10)])
    world.add_push(40, [rev(400)], backstop=True, jobs=[job(2, "testfailed", 4)])
    world.add_push(41, [rev(410)])
    world.add_push(50, [rev(500)], backstop=True, jobs=[job(3, "testfailed", 1)])
    world.add_push(60, [rev(600)], backstop=True, jobs=[job(4, "testfailed", 4)])
    world.add_push(61, [rev(610)], backstop=True, jobs=[job(5, state="running")])
    world.add_main_push(500, [(rev(100), DEV, "a")], 1500)
    world.add_main_push(501, [(rev(410), DEV, "b"), (rev(400), DEV, "c")], 4200)
    world.add_main_push(502, [(rev(500), DEV, "d")], 5100)


def useful_and_skipped(comparisons):
    useful = [c.push.id for c in comparisons if c.skip_reason is None]
    skipped = [c.push.id for c in comparisons if c.skip_reason is not None]
    return useful, skipped


def test_last_backstops_counts_only_useful_comparisons(world):
    last_backstops_history(world)
    comparisons = compare("--last-backstops", "2")
    assert [c.push.id for c in comparisons] == [10, 40, 50, 60]
    assert useful_and_skipped(comparisons) == ([10, 50], [40, 60])
    assert [c.skip_reason for c in comparisons if c.skip_reason] == [
        "merged as part of later autoland push 41",
        "not merged into mozilla-central yet",
    ]


def test_last_backstops_stops_after_enough_useful(world):
    last_backstops_history(world)
    comparisons = compare("--last-backstops", "1")
    assert useful_and_skipped(comparisons) == ([50], [60])


def test_last_backstops_warns_when_too_few(world, caplog):
    last_backstops_history(world)
    comparisons = compare("--last-backstops", "5")
    assert useful_and_skipped(comparisons) == ([10, 50], [40, 60])
    assert "Only found 2 useful comparison(s)" in caplog.text


def test_last_backstops_text_report(world):
    last_backstops_history(world)
    code, out = run(["--compare", "--last-backstops", "2"])
    assert code == am.EXIT_MISMATCH
    assert out.index(f"Backstop {rev(100)[:12]}") < out.index(f"Backstop {rev(500)[:12]}")
    assert f"Backstop {rev(400)[:12]}" not in out
    assert (
        "Skipped:\n"
        f"  {rev(400)[:12]} (autoland push 40): merged as part of later autoland push 41\n"
        f"  {rev(600)[:12]} (autoland push 60): not merged into mozilla-central yet"
    ) in out
    assert out.rstrip().endswith(
        "2 compared, 2 skipped\n  clean: 1 match, 0 differ\n  blocked: 0 match, 1 differ"
    )


def test_last_backstops_with_cherry_picks(world):
    jobs, notes = fixed_by(rev(120))
    merged_history(world, jobs, notes, picks=[rev(120)])
    world.add_push(
        20, [rev(200)], backstop=True, jobs=[job(5, "testfailed", 4)], timestamp=MERGE_TS + 1000
    )
    world.add_main_push(700, [(rev(200), DEV, "Bug 20 - commit")], MERGE_TS + 2000)
    comparisons = compare("--last-backstops", "2")
    assert useful_and_skipped(comparisons) == ([10, 20], [])
    assert [c.decision.verdict for c in comparisons] == ["needs-fixes", "clean"]
    assert all(c.differences == [] for c in comparisons)


@pytest.mark.parametrize("value", ["0", "-1", "x"])
def test_last_backstops_must_be_positive(value):
    with pytest.raises(SystemExit):
        am.parse_args(["--compare", "--last-backstops", value])


@pytest.mark.parametrize(
    "argv",
    [
        ["--compare", "--backstop", rev(100), "--push"],
        ["--compare"],
        ["--last-backstops", "2"],
        ["--compare", "--last-backstops", "2", "--backstop", rev(100)],
        ["--compare", "--backstop", rev(100), "--json"],
    ],
)
def test_compare_argument_validation(world, argv):
    build_history(world, [job(1)])
    with pytest.raises(am.MergeError):
        run(argv)
    assert world.submitted == []


def test_compare_cache_replays_without_network(tmp_path):
    argv = ["--compare", "--last-backstops", "2", "--cache-dir", str(tmp_path)]
    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        last_backstops_history(World(rsps))
        first = run(argv)
    assert list(tmp_path.glob("*.json"))
    with responses.RequestsMock(assert_all_requests_are_fired=False):
        second = run(argv)
    assert second == first
    assert "2 compared, 2 skipped" in second[1]


def test_compare_cache_is_a_snapshot(tmp_path):
    argv = ["--compare", "--last-backstops", "1", "--cache-dir", str(tmp_path)]
    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        world = World(rsps)
        last_backstops_history(world)
        first = run(argv)
        world.add_push(80, [rev(800)], backstop=True, jobs=[job(9, "testfailed", 4)])
        world.add_main_push(503, [(rev(800), DEV, "e")], 8100)
        cached = run(argv)
        live = run(argv[:3])
    assert first == cached
    assert f"Backstop {rev(800)[:12]}" not in cached[1]
    assert f"Backstop {rev(800)[:12]}" in live[1]


def test_cache_stores_404_but_not_server_errors(tmp_path):
    api = am.Api(cache_dir=tmp_path)
    with responses.RequestsMock() as rsps:
        rsps.add(responses.GET, "https://example.com/missing", status=404)
        rsps.add(responses.GET, "https://example.com/broken", status=500)
        assert am.get(api, "https://example.com/missing", allow_404=True) is None
        with pytest.raises(am.requests.HTTPError):
            am.get(api, "https://example.com/broken")
    assert len(list(tmp_path.glob("*.json"))) == 1
    with responses.RequestsMock():
        assert am.get(api, "https://example.com/missing", allow_404=True) is None


def test_cache_key_includes_params(tmp_path):
    api = am.Api(cache_dir=tmp_path)
    with responses.RequestsMock() as rsps:
        rsps.add(responses.GET, "https://example.com/x", json={"n": 1})
        rsps.add(responses.GET, "https://example.com/x", json={"n": 2})
        assert am.get_json(api, "https://example.com/x", params={"a": 1}) == {"n": 1}
        assert am.get_json(api, "https://example.com/x", params={"a": 2}) == {"n": 2}
    with responses.RequestsMock():
        assert am.get_json(api, "https://example.com/x", params={"a": 2}) == {"n": 2}
        assert am.get_json(api, "https://example.com/x", params={"a": 1}) == {"n": 1}


def test_prefetch_fills_cache_without_comparisons(world, tmp_path):
    last_backstops_history(world)
    argv = ["--compare", "--last-backstops", "2", "--cache-dir", str(tmp_path), "--prefetch"]
    code, out = run(argv)
    assert code == am.EXIT_OK
    assert out == "Prefetched data for 2 compared and 2 skipped backstop(s)\n"
    assert list(tmp_path.glob("*.json"))


@pytest.mark.parametrize(
    "argv",
    [
        ["--compare", "--last-backstops", "2", "--prefetch"],
        ["--cache-dir", "/tmp/x"],
        ["--prefetch"],
    ],
)
def test_cache_argument_validation(world, argv):
    build_history(world, [job(1)])
    with pytest.raises(am.MergeError):
        run(argv)
