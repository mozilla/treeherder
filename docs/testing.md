# Running the Automated Tests

## JavaScript

### Validating JavaScript

We use [Biome] for linting JavaScript/JSX code and [Prettier] for formatting.

To run the linter:

```shell
pnpm lint
```

Or to automatically fix issues found (where possible):

```shell
pnpm lint --write
```

You can also check formatting against Prettier:

```shell
pnpm format:check
```

and to have it actually fix (to the best of its ability) any format issues,
just do:

```shell
pnpm format
```

See the [code style](code_style.md#ui) section for more details.

### Running the Jest front-end tests

The unit tests for the UI are run with [Jest].
The tests are written with react testing library.

### Running the Playwright integration tests

Integration tests are useful when testing higher level components that would be hard to set up with fetch mock.
They are run with [Playwright] (see `playwright.config.js`) in Firefox, which starts the dev server
automatically if it isn't already running on port 5000. API responses for the graphs view tests are replayed
from the HAR recordings in `tests/ui/integration/recordings/`; requests not present in a recording fall
through to the dev server proxy.

The integration tests also run in CI (the `javascript-integration-tests` CircleCI job), with two retries
for any test that fails and traces/screenshots uploaded as build artifacts on failure.

To run the tests:

- If you haven't already done so, install local dependencies by running `pnpm install` from the project root.
- Install the Playwright browser once with `npx playwright install firefox`.
- For unit tests run `pnpm test` to execute the tests.
- For integration tests run `pnpm test:integration` to execute the tests.

#### Firefox notes

The integration tests run against Firefox by default. A couple of things are worth knowing
about clipboard access under Firefox:

- Granting clipboard permissions via `context.grantPermissions()` is a Chromium-only Playwright
  API and throws on Firefox, so the logviewer copy test only requests those permissions when
  `browserName === 'chromium'`.
- Copy/paste would not normally work in a stock headless Firefox build. Playwright ships its own
  patched build of Firefox that permits clipboard writes in tests without an explicit grant, so
  under Playwright's Firefox the copy test still works seamlessly. This is a non-issue in
  practice, just a distinction worth knowing if you ever see clipboard behavior differ outside
  of Playwright's bundled browser.

While working on the frontend, you may wish to watch JavaScript files and re-run the unit tests
automatically when files change. To do this, you may run one of the following commands:

```shell
pnpm test:watch
```

The tests will perform an initial run and then re-execute each time a project file is changed.

## Python

To run all Python tests, including linting, sorting, etc:

```shell
% pip install tox
% tox
```

NOTE: For instructions on how to run tests outside of Docker look at [tests/README.md](https://github.com/mozilla/treeherder/blob/master/tests/README.md).
Running them within Docker is still the recommended option.

### Running a specific set of Python tests

Here are some examples of ways to run the python tests with varying levels
of specificity:

All tests:

```shell
docker compose run backend pytest tests/
```

Just `/etl` tests

```shell
docker compose run backend pytest tests/etl/
```

Just the `test_ingest_pending_pulse_job` within the `/etl` tests

```shell
docker compose run backend pytest tests/ -k test_ingest_pending_pulse_job
```

### Updating backend python test data

There are many parts of the backend data, this section will continue to be updated as we document this process.

For the `sample_data/` there is `tests/sample_data/transform.py`:

- `push_data.json`: list of commits
- `job_data.txt`: list of job data as returned from the TH jobs api
- `pulse_consumer/job_data.json`: specific data that pulse would have for related jobs and pushes
- `pulse_consumer/transformed_job_data.json`: what we transform the pulse data to

That will update the data used for `etl/` using recent live data from autoland.

There are a lot of taskid, revisions, and expected fields to update in tests.  Future work could be done to:

- create a revision list and reference it instead of raw revisions
- create an input file as a start date, end date, and use that instead of hard coded dates in many tests
- ensure variety of platforms, builds, tests, pass/fail, etc. are included
- push_data.json - adjust the dates to have multiple days (1st +1, 2nd +2, 3rd +3)

[biome]: https://biomejs.dev
[prettier]: https://prettier.io
[playwright]: https://playwright.dev
