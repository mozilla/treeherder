# Treeherder Manual Smoke Tests

Quick set of tests to be run prior to:

- Merging a PR
- Deploying from [stage](https://treeherder.allizom.org) to [production](https://treeherder.mozilla.org)

For a PR, depending on what you changed, you may need to only test in one of
these categories.

<!-- prettier-ignore -->
!!! note
    Open the console to look for exceptions.

## Treeherder

1. Initial page loads. Can load more jobs with **Next N** buttons.
2. Switch repos.
3. Classify a job.
4. Retrigger a job on try.
5. Add new jobs and click **Trigger** button on try.
6. Hit `n` key to select next failed job. Hit again should cycle through each.
7. Change filtering to ensure they take effect.
8. Login / Logout

## Perfherder

1. Graphs
2. Compare
3. Alerts

## Ask Sheriffs

1. Ask in `#sheriffs` to test their workflows.
2. Test around any high-risk commits since last deploy.
