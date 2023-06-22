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

Test the following:

1. Initial page loads. Can load more jobs with **Next N** buttons.
2. Switch repos.
3. Classify a job.
4. Retrigger a job on try.
5. Add new jobs and click **Trigger** button on try.
6. Hit `n` key to select next failed job. Hit again should cycle through each.
7. Change filtering to ensure they take effect.
   - Try typing "Linux" or "Win" in the search string box.
8. Toggle unclassified-only mode and back

   - Select an orange job
   - Click on link to filter that kind of job
   - Press letter 'U' to toggle between unclassified jobs and all jobs
   - You should be switching between all jobs of that kind and the orange ones that have not been classified

9. Login / Logout

## Perfherder

1. Graphs
2. Compare
3. Alerts

## Ask Sheriffs

1. Ping with the word `sheriff` in the `#sheriffs` channel and request them
   to test their workflows.
2. Test around any high-risk commits since last deploy.
