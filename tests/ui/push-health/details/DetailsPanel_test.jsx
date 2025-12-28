
import {
  render,
  waitFor,
  fireEvent,
  screen,
  act,
} from '@testing-library/react';
import fetchMock from 'fetch-mock';

import pushHealth from '../../mock/push_health.json';
import fullJob from '../../mock/full_job.json';
import repositories from '../../mock/repositories.json';
import bugSuggestions from '../../mock/bug_suggestions.json';
import DetailsPanel from '../../../../ui/push-health/details/DetailsPanel';
import { getProjectUrl, setUrlParam } from '../../../../ui/helpers/location';

const { jobs } = pushHealth;
const task =
  jobs[pushHealth.metrics.tests.details.needInvestigation[0].jobName][0];
const selectedTaskFull = {
  ...fullJob,
  task_id: 'CwGewDH7RjOIZV-b77hGUQ',
  id: 285852125,
};

describe('DetailsPanel', () => {
  beforeAll(() => {
    setUrlParam('repo', 'try');
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/CwGewDH7RjOIZV-b77hGUQ/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/logs/live_backing.log',
            expires: '2020-06-10T21:59:30.726Z',
            contentType: 'text/plain; charset=utf-8',
          },
          {
            storageType: 'reference',
            name: 'public/logs/live.log',
            expires: '2020-06-10T21:59:30.726Z',
            contentType: 'text/plain; charset=utf-8',
          },
        ],
      },
    );

    fetchMock.get(getProjectUrl('/jobs/285852125/', 'try'), selectedTaskFull);
    fetchMock.get(
      getProjectUrl('/jobs/285852125/bug_suggestions/', 'try'),
      bugSuggestions,
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/O5YBAWwxRfuZ_UlRJS5Rqg/runs/0/artifacts/public/logs/live_backing.log',
      '[taskcluster 2020-05-27 22:09:41.219Z] Task ID: WhN846qNQPin_jnGyF3w-g\n' +
        '[taskcluster 2020-05-27 22:09:41.219Z] Worker ID: i-04f0e9fbffe5a9186\n',
    );
    fetchMock.get(getProjectUrl('/jobs/285852125/text_log_errors/', 'try'), [
      {
        id: 639432541,
        errors: [
          {
            bug_suggestions: {
              search:
                'TEST-UNEXPECTED-FAIL | devtools/client/debugger/test/mochitest/browser_dbg-sourcemaps.js | Uncaught exception - at chrome://mochitests/content/browser/devtools/client/debugger/test/mochitest/helpers.js:358 - TypeError: can\'t access property "wrapClass", lineInfo is null',
              bugs: {
                open_recent: [],
                all_others: [],
              },
              line_number: 18841,
            },
            line:
              '22:42:53     INFO - TEST-UNEXPECTED-FAIL | devtools/client/debugger/test/mochitest/browser_dbg-sourcemaps.js | Uncaught exception - at chrome://mochitests/content/browser/devtools/client/debugger/test/mochitest/helpers.js:358 - TypeError: can\'t access property "wrapClass", lineInfo is null',
            line_number: 18841,
          },
        ],
      },
    ]);
  });

  const testDetailsPanel = (selectedTask) => (
    <DetailsPanel
      selectedTask={selectedTask}
      closeDetails={() => {}}
      currentRepo={repositories[1]}
    />
  );

  test('should have artifacts', async () => {
    render(testDetailsPanel(task));

    // Wait for the component to finish loading async data
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const artifactsTab = await screen.findByText(
      'Artifacts and Debugging Tools',
    );

    await act(async () => {
      fireEvent.click(artifactsTab);
    });

    // Wait for state updates after clicking the tab
    await waitFor(() => {
      expect(screen.getAllByTestId('task-artifact')).toHaveLength(2);
    });
  });

  test('should have bug suggestions', async () => {
    render(testDetailsPanel(task));

    // Wait for the component to finish loading async data
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const failuresTab = await screen.findByText('Failure Summary');

    await act(async () => {
      fireEvent.click(failuresTab);
    });

    // Wait for state updates after clicking the tab
    await waitFor(() => {
      expect(screen.getAllByTestId('bug-list-item')).toHaveLength(2);
    });
  });

  test('should have a log viewer with custom buttons', async () => {
    render(testDetailsPanel(task));

    // Wait for the component to finish loading async data
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const LogViewerTab = await screen.findByText('Log Viewer');

    await act(async () => {
      fireEvent.click(LogViewerTab);
    });

    // Wait for state updates after clicking the tab
    await waitFor(() => {
      expect(screen.getByText('Text Log')).toBeInTheDocument();
    });

    expect(screen.getByText('Full Screen')).toBeInTheDocument();
  });
});
