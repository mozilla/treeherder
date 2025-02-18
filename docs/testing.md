# Running the Automated Tests

## JavaScript

### Validating JavaScript

We run our JavaScript code in the frontend through [ESLint] to ensure
that new code has a consistent style and doesn't suffer from common
errors. ESLint will run automatically when you build the JavaScript code
or run the development server. A production build will fail if your code
does not match the style requirements.

To run ESLint by itself, you may run the lint task:

```shell
yarn lint
```

Or to automatically fix issues found (where possible):

```shell
yarn lint --fix
```

You can also check against Prettier:

```shell
yarn format:check
```

and to have it actually fix (to the best of its ability) any format issues,
just do:

```shell
yarn format
```

See the [code style](code_style.md#ui) section for more details.

### Running the Jest front-end tests

The unit tests for the UI are run with [Jest].
The tests are written with react testing library. For the integration tests PollyJS is used to mock APIs.

Integration tests are useful when testing higher level components that would be hard to setup with fetch mock.
They use PollyJS because it helps to automatically record and replay requests/responses.
To refresh the PollyJS recordings (usually when an endpoint response changes), just delete the recordings folder and run `yarn test:integration` again like described below.

To run the tests:

- If you haven't already done so, install local dependencies by running `yarn install` from the project root.
- For unit tests run `yarn test` to execute the tests.
- For integration tests run `yarn test:integration` to execute the tests.

While working on the frontend, you may wish to watch JavaScript files and re-run the unit tests
automatically when files change. To do this, you may run one of the following commands:

```shell
yarn test:watch
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
docker-compose run backend pytest tests/
```

Just `/etl` tests

```shell
docker-compose run backend pytest tests/etl/
```

Just the `test_ingest_pending_pulse_job` within the `/etl` tests

```shell
docker-compose run backend pytest tests/ -k test_ingest_pending_pulse_job
```

### Updating backend python test data

There are many parts of the backend data, this section will continue to be updated as we document this process.

For the `sample_data/` there is `tests/sample_data/transform.py`:

- `push_data.json`: list of commits
- `job_data.txt`: list of job data as returned from the TH jobs api
- `pulse_consumer/job_data.json`: specific data that pulse would have for related jobs and pushes
- `pulse_consumer/transformed_job_data.json`: what we transform the pulse data to

The will update the data used for `etl/` using recent live data from autoland.

There are a lot of taskid, revisions, and expected fields to update in tests.  Future work could be done to:

- create a revision list and reference it instead of raw revisions
- create an input file as a start date, end date, and use that instead of hard coded dates in many tests
- ensure variety of platforms, builds, tests, pass/fail, etc. are included
- push_data.json - adjust the dates to have multiple days (1st +1, 2nd +2, 3rd +3)

[eslint]: https://eslint.org
