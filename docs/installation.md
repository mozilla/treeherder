# Installation

## Prerequisites

- If you are new to Mozilla or Treeherder, read the [A-Team Bootcamp].
- Install [Git]
- Clone the [treeherder repo] from GitHub.

If you only want to hack on the frontend, see the UI Development section below. If you want to hack on the backend or work full-stack, see the [Server and Full-stack Development](#server-and-full-stack-development) section.

## UI Development

To get started:

- Install [Node.js] and [Yarn] (see [package.json] for known compatible versions, listed under `engines`).
- Run `yarn install` to install all dependencies.

### Running the standalone development server

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Docker environment unless making backend changes.

- Start the development server by running:

  ```bash
  $ yarn start
  ```

  <!-- prettier-ignore -->
  !!! note
      Any action you take, such as classifying a job, will affect the live production
      front-end of Treeherder, so we recommend developing against `stage` (details below)
      unless there's something data-specific that must be addressed on production.

- The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

  To run the unminified UI with data from the staging site instead of the production site, type:

  ```bash
  $ yarn start:stage
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

### Running the migrations

To run the Django migrations:

```bash
docker-compose run backend sh -c "./initialize_data.sh"
```

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

### Running the ingestion tasks

Ingestion tasks populate the database with version control push logs, queued/running/completed jobs & output from log parsing, as well as maintain a cache of intermittent failure bugs. To run these:

- Start up a celery worker to process async tasks:

  ```bash
  docker-compose run backend celery -A treeherder worker -B --concurrency 5
  ```

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times.

- Then in a new terminal window, run `docker-compose run backend bash`, and follow the steps from the [loading pulse data](pulseload.md) page.

### Ingesting a single push (at a time)

<!-- prettier-ignore -->
!!! warning
    With the end of life of buildbot, this command is no longer able to ingest jobs.
    For now, after running it, you will need to manually follow the steps from the
    [loading pulse data](pulseload.md) page.

Alternatively, instead of running a full ingestion task, you can process just
the jobs associated with any single push generated in the last 4 hours
([builds-4h]), in a synchronous manner. This is ideal for testing. For example:

[builds-4h]: http://builddata.pub.build.mozilla.org/buildjson/

```bash
docker-compose run backend ./manage.py ingest_push mozilla-inbound 63f8a47cfdf5
```

If running this locally, replace `63f8a47cfdf5` with a recent revision (= pushed within
the last four hours) on mozilla-inbound.

### Ingesting a range of pushes

It is also possible to ingest the last N pushes for a repository:

```bash
docker-compose run backend ./manage.py ingest_push mozilla-central --last-n-pushes 100
```

In this mode, only the pushlog data will be ingested: additional results
associated with the pushes will not. This mode is useful to seed pushes so
they are visible on the web interface and so you can easily copy and paste
changesets from the web interface into subsequent `ingest_push` commands.

Continue to **Working with the Server** section after looking at the [Code Style](code_style.md) doc.

[a-team bootcamp]: https://ateam-bootcamp.readthedocs.io
[git]: https://git-scm.com
[treeherder repo]: https://github.com/mozilla/treeherder
[jest]: https://jestjs.io/docs/en/tutorial-react
[node.js]: https://nodejs.org/en/download/current/
[yarn]: https://yarnpkg.com/en/docs/install
[package.json]: https://github.com/mozilla/treeherder/blob/master/package.json
[eslint]: https://eslint.org
