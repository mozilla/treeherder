# Writing Tests

## Purpose

- Tests should be fast, deterministic, and focused. Prefer unit tests for logic, integration tests for component interactions, and end-to-end tests for critical workflows.

## Frameworks we use

- Python
  - Test runner: `pytest` (with `pytest-django` for Django integration).
  - Mocks: `responses` for HTTP responses; `pytest-mock` patterns also appear.
  - Test data: fixtures under `tests/sample_data/`.
  - Database tests: use `@pytest.mark.django_db`.
- Frontend
  - Unit tests: `Jest` with React Testing Library.
  - Integration: PollyJS recordings are used for integration tests to record/replay API interactions.
  - End-to-end: `jest-puppeteer`/Puppeteer is available for e2e tests.

## Guidelines

- Test small units of logic first (pure functions, transformers).
- Use `responses` to mock external HTTP requests.
- Use `@pytest.mark.django_db` when interacting with the DB.
- Keep unit tests fast (<100ms each ideally). Group slow tests and run separately.
- For frontend components use React Testing Library; avoid testing implementation details.
- Use fixtures (`tests/conftest.py`) and shared sample data in `tests/sample_data/`.
- Freeze time where necessary or inject clock values (e.g., `freezegun`) to keep tests deterministic.

## Examples

- Mocking HTTP:

```python
responses.add(responses.GET, "https://api.example", json={"ok": True}, status=200)
```

- Simple pytest fixture:

```python
@pytest.fixture
def github_push(sample_data):
    return copy.deepcopy(sample_data.github_push)
```

- DB test example:

```python
@pytest.mark.django_db
def test_ingest_hg_push(...):
    PushLoader().process(...)
    assert Push.objects.count() == 1
```

## Resources

- [Pytest](https://docs.pytest.org/)
- [Pytest-Django](https://pytest-django.readthedocs.io/)
- [Responses](https://github.com/getsentry/responses)
- [React Testing Library](https://testing-library.com/)
- [Jest](https://jestjs.io/)
- [PollyJS](https://netflix.github.io/pollyjs/)

## Best practices

- Keep tests deterministic and mock external dependencies.
- Run `yarn test` and `pytest` locally in Docker as per `docs/testing.md`.
- Add tests for bug fixes and new public APIs.
