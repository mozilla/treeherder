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

- Install [Node.js] and [pnpm] (see [package.json] for known compatible versions, listed under `engines` and `packageManager`).
- Run `pnpm install` to install all dependencies.
- Run `pnpm build` to build necessary files.

### Running the standalone development server

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Docker environment unless making backend changes.

- Start the development server by running:

  ```bash
  pnpm start:stage
  ```

  <!-- prettier-ignore -->
  !!! note
      We recommend developing against `stage` to avoid accidentally affecting the live
      production front-end of Treeherder (e.g. classifying a job). If you need production
      data specifically, you can use `pnpm start` instead, which proxies to production.

- The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

## Server and Full-stack Development

To get started:

- Install [Docker] (Docker Compose is included with Docker Desktop for Windows/Mac; on Linux, install the Docker Compose plugin).

- If you just wish to [run the tests](backend_tasks.md#running-the-tests),
  you can stop now without performing the remaining steps.

### Starting a local Treeherder instance

`docker compose up` starts the backend, frontend, database, and a Celery worker that
stores pushes and tasks. It also starts a Pulse listener that, when configured, feeds
live `autoland` and `try` data into that worker.

Live ingestion needs a **Pulse Guardian** user; there is no shared default account. Without
one, the `pulse-task-push` service exits quietly and everything else still works, so you can
skip it and use [manual ingestion](#manual-ingestion) instead. To set it up, follow
[Pulse Ingestion Configuration](pulseload.md#pulse-ingestion-configuration) and put the
result in a `.env` file in the repository root (see
[Configuring with a `.env` file](#configuring-with-a-env-file)).

- Open a shell, cd into the root of the Treeherder repository, and type:

  ```bash
  docker compose up --build
  ```

- Wait for the Docker images to be downloaded/built and container steps to complete.

- Visit <http://localhost:5000> in your browser (NB: not port 8000).

Both Django's runserver and rspack-dev-server will automatically refresh every time there's a change in the code.
Proceed to [Running the ingestion tasks](#running-the-ingestion-tasks) to get data.

### Using the minified UI

If you would like to use the minified production version of the UI with the development backend:

- Run the build task:

  ```bash
  docker compose run frontend sh -c "corepack enable && pnpm install && pnpm build"
  ```

- Start Treeherder's backend:

  ```bash
  docker compose up --build
  ```

- Visit <http://localhost:8000> (NB: port 8000, unlike above)

Requests to port 8000 skip rspack-dev-server, causing Django's runserver to serve the
production UI from `.build/` instead. In addition to being minified and using the
non-debug versions of React, the assets are served with the same `Content-Security-Policy`
header as production.

Proceed to [Running the ingestion tasks](#running-the-ingestion-tasks) to get data.

### Configuring with a `.env` file

Docker Compose reads a file named `.env` in the repository root and substitutes its values
into `docker-compose.yml`. This is the easiest way to keep settings such as `PULSE_URL`
across restarts. Both plain and `export`-prefixed lines work, so the same file can also be
sourced by your shell:

```bash
PULSE_URL=amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1
export PROJECTS_TO_INGEST=autoland,try
```

Do not quote the `PULSE_URL` value. `.env` is gitignored.

The variables most relevant to local ingestion are:

| Variable             | Default          | Purpose                                                                                     |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `PULSE_URL`          | (unset)          | Pulse Guardian credentials. Required for live ingestion; not needed for manual ingestion.  |
| `PROJECTS_TO_INGEST` | `autoland,try`   | Repositories the Celery worker stores. Others are ignored.                                  |
| `SKIP_INGESTION`     | `False`          | Set to `True` to stop the Pulse listener from connecting at all.                            |
| `DATABASE_URL`       | local Postgres   | Point at an external database instead of the Postgres container.                            |
| `TLS_CERT_PATH`      | (unset)          | CA certificate for TLS to a remote database (see [Accessing Data](accessing_data.md)). Not used by ingestion and not needed for the local Postgres container. |

### Running full stack with a custom DB setting

If you want to develop both the frontend and backend, but have the database pointing to
an external DB host, you have a few choices. The environment variable of `DATABASE_URL`
is what needs to be set. You can do this in the `.env` file described above:

```bash
DATABASE_URL=psql://user:password@hostname/treeherder
```

Alternatively, you can `export` that value in your terminal prior to executing
`docker compose up` or just specify it on the command line as you execute:

```bash
DATABASE_URL=psql://user:password@hostname/treeherder SKIP_INGESTION=True docker compose up
```

<!-- prettier-ignore -->
!!! note
    If you are using a database on one of our instances (production, stage or prototype) then
    you should also disable data ingestion via Pulse.  It will ONLY ingest to your local DB,
    even if `DATABASE_URL` is set.  But it will use your system's resources unnecessarily.
    To skip data ingestion, set the var `SKIP_INGESTION=True`

### Deleting the Postgres database

The Postgres database is kept locally and is not destroyed when the Docker containers are destroyed.
If you want to start from scratch type the following commands:

```bash
docker compose down
docker volume rm treeherder_postgres_data
```

### Running the ingestion tasks

Celery tasks include storing of pushes and tasks, parsing logs (which provides failure lines
and performance data), and generating alerts (for Perfherder).

`docker compose up` already starts a `celery` service that consumes the
`store_pulse_pushes`, `store_pulse_tasks` and `store_pulse_tasks_classification` queues,
so with `PULSE_URL` set, pushes and tasks for `PROJECTS_TO_INGEST` appear in the UI without
any further steps. Storing a task also schedules log parsing, but nothing consumes the
`log_parser` queues by default.

To run every queue, including log parsing and Perfherder alert generation, open a new shell
tab and start a second worker:

```bash
docker compose run --rm backend celery -A treeherder worker --concurrency 1
```

You can find the list of queues in the `CELERY_TASK_QUEUES` variable in the [settings]
file. To run only some of them, pass `-Q`. For instance, to only parse logs:

```bash
docker compose run --rm backend celery -A treeherder worker -Q log_parser,log_parser_fail_raw_sheriffed,log_parser_fail_json_sheriffed --concurrency 1
```

<!-- prettier-ignore -->
!!! note
    `PROJECTS_TO_INGEST` defaults to `autoland,try` in `docker-compose.yml`. Set it in
    `.env` to store other repositories. Leaving it empty stores pushes and tasks from all
    repositories, which takes a very long time.

### Manual ingestion

Manual ingestion pulls a specific push or task from Taskcluster on demand. It does not need
`PULSE_URL`. Run `docker compose up` in one terminal first; all commands below run in a second
terminal.

<!-- prettier-ignore -->
!!! note
    You have to include `--root-url https://community-tc.services.mozilla.com` in order to ingest from the [Taskcluster Community instance](https://community-tc.services.mozilla.com), otherwise, it will default to the Firefox CI.

#### Picking a revision

The examples below use `<REVISION>` as a placeholder. Use a recent push: open
<https://treeherder.mozilla.org/jobs?repo=autoland> and copy a revision hash from the push
list. Task data expires from Taskcluster after about a year, so an old revision will
ingest the push but fail with `Index URL ... not found` when you ask for its tasks.

#### Ingest pushes

<!-- prettier-ignore -->
!!! note
    Only the push information will be ingested. Tasks
    associated with the pushes will not. This mode is useful to seed pushes so
    they are visible on the web interface and so you can easily copy and paste
    changesets from the web interface into subsequent commands to ingest all tasks.

```bash
docker compose exec backend ./manage.py ingest push -p autoland -r <REVISION>
```

To seed several pushes at once:

```bash
docker compose exec backend ./manage.py ingest push -p autoland --last-n-pushes 100
```

#### Ingest all the tasks for a push

This ingests every task in the push and, with `--enable-eager-celery`, runs log parsing
and performance data ingestion inline. `--enable-eager-celery` is required to capture the
`PERFHERDER_DATA` output that Perfherder uses.

> **Warning:** This can take a long time. Each task's log is parsed inline, so budget
> roughly five minutes per hundred tasks, and a busy `autoland` push can have thousands.

```bash
docker compose exec backend ./manage.py ingest push -p autoland -r <REVISION> -a --enable-eager-celery
```

#### Ingest a single task

Faster than a whole push when you only need one job. The task id is in the job details
panel on Treeherder, or in the Taskcluster task URL.

```bash
docker compose exec backend ./manage.py ingest task -p autoland -r <REVISION> --task-id <TASK-ID> --enable-eager-celery
```

#### Inspecting the database

You can use any database viewer of your choice (e.g. DBeaver, pgAdmin, `psql`). While
`docker compose up` is running, connect with:

```code
Host:     localhost
Port:     5432 (or the value of POSTGRES_PORT in .env)
Database: treeherder
Username: postgres
Password: mozilla1234
```

#### Ingest a single Github push or the last 10

```bash
docker compose exec backend ./manage.py ingest git-push -p servo-try -c 92fc94588f3b6987082923c0003012fd696b1a2d
docker compose exec -e GITHUB_TOKEN=<foo> backend ./manage.py ingest git-pushes -p android-components
```

!!! note
    You can ingest all tasks for a push. Check the help output for the script to determine the
    parameters needed.

!!! note
    If you make too many calls to the Github API you will start getting 403 messages because of the rate limit.
    To avoid this visit [your settings](https://github.com/settings/tokens) and set up `GITHUB_TOKEN`. You don't need
    to grant scopes for it.

#### Ingesting Github PRs

!!! note
    This will only ingest the commits if there's an active Github PRs project. It will only ingest the commits.

```bash
docker compose exec backend ./manage.py ingest pr --pr-url https://github.com/mozilla-mobile/android-components/pull/4821
```

#### Ingesting individual task

This will work if the push associated to the task exists in the database.

```bash
# Make sure to ingest 1bd9d4f431c4c9f93388bd04a6368cb07398f646 for autoland first
docker compose exec backend ./manage.py ingest task --task-id KQ5h1BVYTBy_XT21wFpLog
```

## Learn more

Continue to **Working with the Server** section after looking at the [Code Style](code_style.md) doc.

[a-team bootcamp]: https://ateam-bootcamp.readthedocs.io
[git]: https://git-scm.com
[treeherder repo]: https://github.com/mozilla/treeherder
[node.js]: https://nodejs.org/en/download/current/
[pnpm]: https://pnpm.io/installation
[package.json]: https://github.com/mozilla/treeherder/blob/master/package.json
[settings]: https://github.com/mozilla/treeherder/blob/master/treeherder/config/settings.py#L318
