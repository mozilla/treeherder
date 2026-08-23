/**
 * Shared API mocks for the Jobs view integration tests.
 *
 * API responses are served from the JSON fixtures in tests/ui/mock/
 * (the same fixtures the Jest unit tests use), so the tests are
 * deterministic and independent of any backend.
 */

const fs = require('node:fs');
const path = require('node:path');

const MOCK_DIR = path.resolve(__dirname, '../../mock');
const loadFixture = (file) =>
  JSON.parse(fs.readFileSync(path.join(MOCK_DIR, file), 'utf8'));

const repositories = loadFixture('repositories.json');
const pushList = loadFixture('push_list.json');
const jobList = loadFixture('job_list/job_1.json');
const taskDefinition = loadFixture('task_definition.json');
const BUG_SUGGESTIONS = loadFixture('bug_suggestions.json');

// The job list endpoint returns rows of values keyed by job_property_names;
// zip them into objects for the /jobs/{id}/ detail endpoint.
const jobsById = new Map(
  jobList.results.map((row) => {
    const job = Object.fromEntries(
      jobList.job_property_names.map((name, i) => [name, row[i]]),
    );
    return [job.id, job];
  }),
);

const jobBySymbol = (symbol) =>
  [...jobsById.values()].find((job) => job.job_type_symbol === symbol);

// The busted build job on the first push in push_list.json.
const BUILD_JOB = jobBySymbol('B');

// The selectedTaskRun URL parameter value for a job.
const taskRunStr = (job) => `${job.task_id}.${job.retry_id}`;

const FAILURE_CLASSIFICATIONS = [
  { id: 1, name: 'not classified' },
  { id: 2, name: 'fixed by commit' },
  { id: 3, name: 'expected fail' },
  { id: 4, name: 'intermittent' },
  { id: 5, name: 'infra' },
  { id: 6, name: 'new failure not classified' },
  { id: 8, name: 'intermittent needs bugid' },
];

const SHERIFF_USER = {
  id: 1,
  username: 'mozilla-ldap/sheriff@mozilla.com',
  email: 'sheriff@mozilla.com',
  is_staff: true,
  is_superuser: false,
};

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Seed the browser session so the app treats the user as logged in.
 * The Login component only trusts the /api/user/ response when a
 * userSession entry exists in localStorage; pair this with
 * `mockJobsViewApi(page, { user: [SHERIFF_USER] })`.
 * Must be called before page.goto().
 */
async function seedLoggedInSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'userSession',
      JSON.stringify({
        fullName: 'Sheriff Tester',
        renewAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    );
  });
}

/**
 * Route all API calls the Jobs view makes to fixture data.
 *
 * Returns a `captured` object that accumulates the payloads of POSTs
 * to the classification endpoints, so tests can assert what would
 * have been written to the backend.
 */
async function mockJobsViewApi(page, { user = [], bugSuggestions = [] } = {}) {
  const captured = { notes: [], bugJobMaps: [] };

  await page.route('**/revision.txt', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'abc123' }),
  );
  await page.route('**/api/repository/', (route) =>
    route.fulfill(json(repositories)),
  );
  await page.route('**/api/user/', (route) => route.fulfill(json(user)));
  await page.route('**/api/failureclassification/', (route) =>
    route.fulfill(json(FAILURE_CLASSIFICATIONS)),
  );
  await page.route('**/api/performance/framework/', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/performance/tag/', (route) =>
    route.fulfill(json([])),
  );

  // Initial push list; polling and other push queries get empty results.
  await page.route('**/api/project/autoland/push/**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('count') === '10') {
      return route.fulfill(json(pushList));
    }
    return route.fulfill(json({ results: [] }));
  });

  // Job list per push.
  await page.route('**/api/jobs/**', (route) => route.fulfill(json(jobList)));

  // Details panel endpoints for the selected job.
  await page.route('**/api/project/autoland/jobs/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/bug_suggestions/')) {
      return route.fulfill(json(bugSuggestions));
    }
    if (pathname.endsWith('/text_log_errors/')) {
      return route.fulfill(json([]));
    }
    const match = pathname.match(/\/jobs\/(\d+)\/$/);
    const job = match && jobsById.get(Number(match[1]));
    if (job) {
      return route.fulfill(json(job));
    }
    return route.fulfill(json([]));
  });

  // Classification endpoints: capture writes, serve empty reads.
  await page.route('**/api/project/autoland/note/**', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      captured.notes.push(payload);
      return route.fulfill(json({ ...payload, id: captured.notes.length }));
    }
    return route.fulfill(json([]));
  });
  await page.route('**/api/project/autoland/bug-job-map/**', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      captured.bugJobMaps.push(payload);
      return route.fulfill(json(payload));
    }
    return route.fulfill(json([]));
  });

  await page.route('**/api/project/autoland/performance/job-data/**', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/project/autoland/job-log-url/**', (route) =>
    route.fulfill(json([])),
  );

  // External services.
  await page.route(
    'https://treestatus.prod.lando.prod.cloudops.mozgcp.net/**',
    (route) =>
      route.fulfill(
        json({ result: { status: 'open', reason: '', tree: 'autoland' } }),
      ),
  );
  await page.route('https://firefox-ci-tc.services.mozilla.com/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/artifacts')) {
      return route.fulfill(json({ artifacts: [] }));
    }
    if (pathname.includes('/api/queue/v1/task/')) {
      return route.fulfill(json(taskDefinition));
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.route('https://bugzilla.mozilla.org/rest/bug**', (route) =>
    route.fulfill(json({ bugs: [] })),
  );

  return captured;
}

module.exports = {
  mockJobsViewApi,
  seedLoggedInSession,
  jobsById,
  jobBySymbol,
  taskRunStr,
  BUILD_JOB,
  SHERIFF_USER,
  FAILURE_CLASSIFICATIONS,
  BUG_SUGGESTIONS,
  pushList,
};
