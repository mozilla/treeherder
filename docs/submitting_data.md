# Submitting data to Treeherder

To submit your data to Treeherder you need your tasks running on Taskcluster.

If you are establishing a new repository with Treeherder, then you will need to
do one of the following:

1. For GitHub repos: [Adding a GitHub Repository](#adding-a-github-repository)

2. For Mercurial repos: [Add a new Mercurial repository](#adding-a-mercurial-repository)

## Adding a GitHub Repository

The pushes from GitHub repos come to Treeherder via Pulse. The webhook to enable
this exists in the GitHub group `mozilla`. (For example, `github.com/mozilla/treeherder`)

The following steps are required:

1. Create a PR with the new repository information added to the fixtures file:
   `treeherder/model/fixtures/repository.json`

2. Open a bug request to enable the webhook that will trigger pulse messages for
   every push from your repo. Use the following information:

   - Component: GitHub: Administration
   - Ask to install the <https://github.com/apps/taskcluster> integration on your repositories
   - List the repositories you want to have access to the integration
   - Answer: Are any of those repositories private?
   - State that this is only to get Pulse messages for integration into Treeherder

## Adding a Mercurial repository

To add a new repository, the following steps are needed:

- Append new repository information to the fixtures file located at:
  `treeherder/model/fixtures/repository.json`
- Restart any running Django runserver/Celery processes.
