# autoland → firefox-main merge script

`autoland_merge.py` decides whether the most recent completed autoland backstop push can be merged into `firefox-main`, and optionally performs the merge through the Lando headless API.

It is standalone: it does not import any Treeherder code, and its dependencies are declared inline (PEP 723), so `uv run` installs them.

## Usage

```sh
uv run misc/autoland_merge/autoland_merge.py
uv run misc/autoland_merge/autoland_merge.py --json
uv run misc/autoland_merge/autoland_merge.py --backstop 679f6fda1052 --json
LANDO_HEADLESS_API_TOKEN=... uv run misc/autoland_merge/autoland_merge.py --push
```

Without `--push` the script is a dry run. It makes every read request needed to compute the decision and build the exact Lando request, including downloading the cherry-pick patches, but it submits nothing. Output is a text report, or JSON with `--json`.

When there is something to submit, a dry run also prints the request it would send: the URL and the JSON body. In the text report this comes at the end. In JSON it is under `lando_request` (`url` and `body`). The body is produced by the same code `--push` uses. The one difference is that each cherry-pick's base64 `content` is replaced with a short placeholder such as `<8451-byte patch for 73ad41f6…>`, giving the decoded patch size and the git commit. `--push` always sends the real patches.

`--backstop <revision>` evaluates one specific backstop push instead of searching for the latest completed one. Pass the hg revision of the push's tip-most commit: the full 40 characters, or a prefix of at least 12 like the ones Treeherder shows. It must be the tip of an autoland push.
- The push must be a backstop.
- A backstop that still has `pending` or `running` jobs is assessed anyway, with a warning, but `--push` refuses to submit it.
- A push that is already merged is still fully evaluated, and the script exits 3 without submitting anything.

API URLs and repository names live in the `Config` dataclass at the top of the script, which `main()` builds and passes down. `LANDO_URL` overrides the Lando URL, for example to test against a Lando dev instance.

## Comparing with what sheriffs actually did

`--compare` puts the script's decision next to what sheriffs actually did on mozilla-central, and lists where the two differ. It prints a text report and never submits anything; `--push` and `--json` are refused.

```sh
uv run misc/autoland_merge/autoland_merge.py --compare --backstop 0f646f4d80f5
uv run misc/autoland_merge/autoland_merge.py --compare --last-backstops 10
```

`--compare` needs exactly one of these:

- **`--backstop <revision>`** compares one backstop. It must be a backstop; an incomplete one is assessed with a warning.
- **`--last-backstops N`** compares backstops from newest to oldest until it has N useful comparisons, then reports them oldest first.
  - Backstops that are still running are passed over without being counted.
  - Backstops that can't be usefully compared are skipped, listed with the reason, and not counted.
  - It searches 150 autoland pushes per requested comparison, and never fewer than 200. If it finds fewer than N, it warns and reports the ones it found.
  - In practice only about 1 backstop in 4 or 5 is useful, because sheriffs usually merge a later push.

### When a comparison is useful

A comparison is only useful when sheriffs merged that exact backstop. That's the only case where the script's decision and the sheriffs' action concern the same merge point. Two kinds of backstop are skipped:

- **Not merged into mozilla-central yet.**
- **Merged as part of a later autoland push.** Sheriffs never merged this backstop itself.

A consequence is that backstops sheriffs passed over are never scored. If the script would merge a backstop that sheriffs deliberately skipped, that doesn't show up as a difference.

### Results

Each useful comparison's result is the script's verdict, plus whether it matches what sheriffs did:

| Result | Meaning |
| --- | --- |
| `clean, matches sheriffs` | Sheriffs merged the backstop with no cherry-picks. |
| `clean, differs from sheriffs` | Sheriffs cherry-picked something the script wouldn't. |
| `needs-fixes, matches sheriffs` | Sheriffs cherry-picked exactly the fixes the script would. |
| `needs-fixes, differs from sheriffs` | The cherry-picks differ. |
| `blocked, differs from sheriffs` | Sheriffs merged a backstop the script would have refused. This is always a difference. |

The differences are listed under each result:
- cherry-picks sheriffs made that the script wouldn't, including ones with no matching autoland commit
- cherry-picks the script would make that sheriffs didn't
- a merge the script would have blocked

The report ends with the skipped backstops, then a count of matches and differences for each verdict. Exit status is 4 when any useful comparison differs, otherwise 0.

Classifications are read as they are now, not as they were at merge time.

### How the sheriffs' merge is reconstructed

The merge is reconstructed from Treeherder's mozilla-central pushes:
- **The merge push** is the first push whose newest non-merge commit already existed on autoland before that push. The merged autoland commit is that commit, and the push is a fast-forward unless it contains a `Merge …` commit.
- **Cherry-picks** are commits that weren't on autoland when they reached mozilla-central. They can be in the merge push itself or in any later push up to the next merge. Because every sheriff merge comes no later than the merge containing the next backstop, this covers the changes between this backstop's merge and the next backstop's merge. The newest merge has no next merge, so its window runs up to now.
  - Pushes by release automation (`ffxbld@lando.moz.tools`) are skipped.
  - Pushes with more than 10 such commits are skipped, since they are direct landings rather than cherry-picks.
- **Each cherry-pick is matched to its original autoland commit** by author and subject line. Cherry-picked commits get new hashes, and only show up on autoland later, through the next "Merge mozilla-central to autoland".

### Caching comparison data

`--cache-dir DIR` stores every response that compare mode fetches in `DIR` and replays it on later runs, so you can re-run comparisons after changing the script's rules without downloading everything again. `--prefetch` fills the cache and prints only how many backstops it compared and skipped. Because each backstop is compared as soon as it's found, an interrupted prefetch still leaves complete data for every backstop it reached.

```sh
uv run misc/autoland_merge/autoland_merge.py --compare --last-backstops 20 --cache-dir /tmp/merge-cache --prefetch
uv run misc/autoland_merge/autoland_merge.py --compare --last-backstops 20 --cache-dir /tmp/merge-cache
```

- **The cache is a snapshot.** Every request is replayed, including "most recent pushes", so new backstops and new classifications only appear once you delete the directory.
- **Smaller requests reuse it.** A smaller `--last-backstops` or a single `--backstop` inside the cached range is answered from the cache. Anything outside it is fetched and added.
- **What's stored:** successful responses and 404s, which are meaningful answers here. Server errors are not stored. Job lists take most of the space.

## How the decision is made

1. **Find the backstop.** Walk the last 200 autoland pushes newest first. A push is a backstop when its decision task's `public/parameters.yml` contains `backstop: true`. The first completed backstop is used: one with no `pending` or `running` jobs. Jobs in any other state, including `unscheduled`, don't hold it back.
2. **Classify failures.** Only tier 1 and 2 jobs whose result is `testfailed`, `busted` or `exception` are considered:
   - `not classified` and `new failure not classified` block the merge.
   - `expected fail`, `intermittent`, `infra`, `autoclassified intermittent` and `intermittent needs bugid` are acceptable.
   - `fixed by commit` jobs need their fix cherry-picked.
3. **Find the fixes.** Each `fixed by commit` job's newest fixed-by-commit note must contain a full 40-character hg revision.
   - Revisions are deduplicated, since several jobs are often fixed by one commit.
   - Fixes already included in the backstop are dropped.
   - The rest are ordered by when they landed on autoland.
   - Each fix is mapped to its git commit with Lando's `hg2git` endpoint.
   - More than 4 distinct fixes blocks the merge.
4. **Already merged?** If Treeherder shows a mozilla-central push containing the backstop's tip revision, there is nothing to do and the script exits 3. Treeherder can lag a few minutes behind the repository.
5. **Build one Lando job.** The job is a `merge-onto` action for the backstop's git commit (from `hg2git`), followed by one `add-commit-base64` action per fix.
   - Each patch is the commit's `.patch` from GitHub.
   - A patch must contain exactly one commit, the requested one. A merge commit (which GitHub serves as a whole patch series) or an empty patch blocks the merge.
   - Lando applies all actions on one branch and pushes once, so either everything lands or nothing does.

When cherry-picks are present, Lando runs its landing checks over every non-merge commit in the job, which includes all merged autoland commits. A plain merge skips those checks.

## Environment

| Variable | Purpose |
| --- | --- |
| `LANDO_HEADLESS_API_TOKEN` | Lando API token. Required with `--push`. |
| `LANDO_URL` | Optional Lando base URL override. |

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Merged, or mergeable (dry run) |
| 1 | Error, or the Lando job did not land |
| 2 | Not mergeable |
| 3 | Nothing to do: the backstop is already on main |
| 4 | `--compare` found at least one useful comparison that differs from sheriffs |

## Tests

```sh
cd misc/autoland_merge
uv run --no-project --with requests --with pyyaml --with pytest --with responses pytest
```
