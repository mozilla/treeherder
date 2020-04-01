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

### Running the Jest front-end unit tests

The unit tests for the UI are run with [Jest].

To run the tests:

- If you haven't already done so, install local dependencies by running `yarn install` from the project root.
- Then run `yarn test` to execute the tests.

While working on the frontend, you may wish to watch JavaScript files and re-run tests
automatically when files change. To do this, you may run one of the following commands:

```shell
yarn test:watch
```

The tests will perform an initial run and then re-execute each time a project file is changed.

## Python

To run all Python tests, including linting, sorting, etc:

```shell
docker-compose run backend sh -c "./runchecks.sh && pytest tests/"
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

## Selenium

The Selenium tests are written in Python, so when you execute some of the
commands above, you will execute the Selenium tests as well.

The Selenium tests require a UI build:

```shell
docker-compose up --build
docker-compose run backend pytest tests/selenium/
```

[eslint]: https://eslint.org
