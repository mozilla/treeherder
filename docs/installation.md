# Installation

## Prerequisites

- If you are new to Mozilla or Treeherder, read the [A-Team Bootcamp].
- Install [Git]
- Clone the [treeherder repo] from GitHub.

If you only want to hack on the frontend, see the UI Development section below. If you want to hack on the backend or work full-stack, see the [Server and Full-stack Development](#server-and-full-stack-development) section.

### Code Standards

Before pushing new code, please make sure you are following our [Code Style](code_style.md#ui) and [Accessibility Guidelines](accessibility.md).

### Pre-commit checks

If you would like pre-commit linting checks you can set it up like this:

```console
% pip install pre-commit
% pre-commit install
pre-commit installed at .git/hooks/pre-commit
```

From here on, linting checks will be executed every time you commit.

## UI Development

To get started:

- Install [Node.js] and [Yarn] (see [package.json] for known compatible versions, listed under `engines`).
- Run `yarn install` to install all dependencies.

### Running the standalone development server

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Docker environment unless making backend changes.

- Start the development server by running:

  ```bash
  yarn start
  ```

  <!-- prettier-ignore -->
  !!! note
      Any action you take, such as classifying a job, will affect the live production
      front-end of Treeherder, so we recommend developing against `stage` (details below)
      unless there's something data-specific that must be addressed on production.

- The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

  To run the unminified UI with data from the staging site instead of the production site, type:

  ```bash
  yarn start:stage
  ```

## Server and Full-stack Development

To get started:

- Install Docker & docker-compose (both are installed if using Docker for Windows/Mac).

- If you just wish to [run the tests](backend_tasks.md#running-the-tests),
  you can stop now without performing the remaining steps.

### Starting a local Treeherder instance

- Open a shell, cd into the root of the Treeherder repository, and type:

  ```bash
  docker-compose up --build
  ```

- Wait for the Docker images to be downloaded/built and container steps to complete.

- Visit <http://localhost:5000> in your browser (NB: not port 8000).

Both Django's runserver and webpack-dev-server will automatically refresh every time there's a change in the code.

<!-- prettier-ignore -->
!!! note
    There will be no data to display until the ingestion tasks are run.

### Using the minified UI

If you would like to use the minified production version of the UI with the development backend:

- Run the build task:

  ```bash
  docker-compose run frontend sh -c "yarn && yarn build"
  ```

- Start Treeherder's backend:

  ```bash
  docker-compose up --build
  ```

- Visit <http://localhost:8000> (NB: port 8000, unlike above)

Requests to port 8000 skip webpack-dev-server, causing Django's runserver to serve the
production UI from `.build/` instead. In addition to being minified and using the
non-debug versions of React, the assets are served with the same `Content-Security-Policy`
header as production.

### Running full stack with a custom DB setting

If you want to develop both the frontend and backend, but have the database pointing to
an external DB host, you have a few choices. The environment variable of `DATABASE_URL`
is what needs to be set. You can do this in a file in the root of `/treeherder` called
`.env`:

```bash
DATABASE_URL=mysql://user:password@hostname/treeherder
```

Alternatively, you can `export` that value in your terminal prior to executing
`docker-compose up` or just specify it on the command line as you execute:

```bash
DATABASE_URL=mysql://user:password@hostname/treeherder docker-compose up
```

<!-- prettier-ignore -->
!!! note
    If you are using a database on one of our instances (production, stage or prototype) then
    you should also disable data ingestion via Pulse.  It will ONLY ingest to your local DB,
    even if `DATABASE_URL` is set.  But it will use your system's resources unnecessarily.
    To skip data ingestion, set the var `SKIP_INGESTION=True`

### Deleting the MySql database

The MySql database is kept locally and is not destroyed when the Docker containers are destroyed.
If you want to start from scratch type the following commands:

```bash
docker-compose down
docker volume rm treeherder_mysql_data
```

### Running the ingestion tasks

Ingestion tasks populate the database with version control push logs, queued/running/completed jobs & output from log parsing, as well as maintain a cache of intermittent failure bugs. To run these:

- Start up a celery worker to process async tasks:

  ```bash
  docker-compose run backend celery -A treeherder worker -B --concurrency 5
  ```

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times.

- Then in a new terminal window, run `docker-compose run backend bash`, and follow the steps from the [loading pulse data](pulseload.md) page.

### Manual ingestion

`NOTE`; You have to include `--root-url https://community-tc.services.mozilla.com` in order to ingest from the [Taskcluster Community instance](https://community-tc.services.mozilla.com), otherwise, it will default to the Firefox CI.

Open a terminal window and run `docker-compose up`. All following sections assume this step.

#### Ingesting pushes

`NOTE`: Only the push information will be ingested. Tasks
associated with the pushes will not. This mode is useful to seed pushes so
they are visible on the web interface and so you can easily copy and paste
changesets from the web interface into subsequent commands to ingest all tasks.

Ingest a single Mercurial push or the last N pushes:

```console
docker-compose exec backend ./manage.py ingest push -p autoland -r 63f8a47cfdf5
docker-compose exec backend ./manage.py ingest mozilla-central --last-n-pushes 100
```

Ingest a single Github push or the last 10:

```console
docker-compose exec backend ./manage.py ingest git-push -p servo-try -c 92fc94588f3b6987082923c0003012fd696b1a2d
docker-compose exec -e GITHUB_TOKEN=<foo> backend ./manage.py ingest git-pushes -p android-components
```

`NOTE`: You can ingest all tasks for a push. Check the help output for the script to determine the
parameters needed.

`NOTE`: If you make too many calls to the Github API you will start getting 403 messages because of the rate limit.
To avoid this visit [your settings](https://github.com/settings/tokens) and set up `GITHUB_TOKEN`. You don't need
to grant scopes for it.

#### Ingesting Github PRs

`NOTE`: This will only ingest the commits if there's an active Github PRs project. It will only ingest the commits.

```bash
docker-compose exec backend ./manage.py ingest pr --pr-url https://github.com/mozilla-mobile/android-components/pull/4821
```

#### Ingesting individual task

This will work if the push associated to the task exists in the database.

```bash
# Make sure to ingest 1bd9d4f431c4c9f93388bd04a6368cb07398f646 for autoland first
docker-compose exec backend ./manage.py ingest task --task-id KQ5h1BVYTBy_XT21wFpLog
```

## Learn more

Continue to **Working with the Server** section after looking at the [Code Style](code_style.md) doc.

[a-team bootcamp]: https://ateam-bootcamp.readthedocs.io
[git]: https://git-scm.com
[treeherder repo]: https://github.com/mozilla/treeherder
[jest]: https://jestjs.io/docs/en/tutorial-react
[node.js]: https://nodejs.org/en/download/current/
[yarn]: https://yarnpkg.com/en/docs/install
[package.json]: https://github.com/mozilla/treeherder/blob/master/package.json
[eslint]: https://eslint.org
