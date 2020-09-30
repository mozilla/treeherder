import React from 'react';
import fetchMock from 'fetch-mock';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ConnectedRouter } from 'connected-react-router';
import { Provider, ReactReduxContext } from 'react-redux';
import { createBrowserHistory } from 'history';

import App from '../../../ui/job-view/App';
import taskDefinition from '../mock/task_definition.json';
import pushListFixture from '../mock/push_list';
import reposFixture from '../mock/repositories';
import { getApiUrl, bzBaseUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import jobListFixtureOne from '../mock/job_list/job_1';
import jobMap from '../mock/job_map';
import { configureStore } from '../../../ui/job-view/redux/configureStore';

const repoName = 'autoland';
const treeStatusResponse = {
  result: {
    message_of_the_day: '',
    reason: '',
    status: 'open',
    tree: repoName,
  },
};
const emptyPushResponse = {
  results: [],
};
const emptyBzResponse = {
  bugs: [],
};
const history = createBrowserHistory();

const testApp = () => {
  const store = configureStore(history);
  return (
    <Provider store={store}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <App user={{ email: 'reviewbot' }} context={ReactReduxContext} />
      </ConnectedRouter>
    </Provider>
  );
};

describe('Filtering', () => {
  beforeAll(() => {
    fetchMock.reset();
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(`begin:${bzBaseUrl}rest/bug`, emptyBzResponse);
    fetchMock.get(
      'begin:https://treestatus.mozilla-releng.net/trees/',
      treeStatusResponse,
    );
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, jobListFixtureOne);
    fetchMock.get(
      `begin:${getProjectUrl(
        '/push/?full=true&count=11&push_timestamp__lte=',
        'autoland',
      )}`,
      emptyPushResponse,
    );
    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ',
      taskDefinition,
    );
  });
  afterEach(() => history.push('/'));

  afterAll(() => {
    fetchMock.reset();
  });

  const jobCount = () => document.querySelectorAll('.job-btn').length;

  describe('by author', () => {
    beforeAll(() => {
      fetchMock.get(
        getProjectUrl('/push/?full=true&count=10&author=reviewbot', 'autoland'),
        {
          results: [
            {
              id: 111111,
              revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
              author: 'reviewbot',
              revision_count: 1,
              push_timestamp: 1562867957,
              repository_id: 4,
              revisions: [
                {
                  repository_id: 4,
                  revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
                  author: 'reviewbot <reviewbot>',
                  comments: 'didathing',
                },
              ],
            },
          ],
        },
      );
    });

    test('should have 1 push', async () => {
      const { getAllByText, getAllByTestId, getByText, getByTitle } = render(
        testApp(),
      );
      const unfilteredPushes = await waitFor(() =>
        getAllByTestId('push-header'),
      );
      expect(unfilteredPushes).toHaveLength(10);

      const myPushes = await waitFor(() => getByText('My pushes only'));
      fireEvent.click(myPushes);

      const filteredAuthor = await waitFor(() => getAllByText('reviewbot'));
      const filteredPushes = await waitFor(() => getAllByTestId('push-header'));

      expect(filteredAuthor).toHaveLength(1);
      expect(filteredPushes).toHaveLength(1);

      const filterCloseBtn = await getByTitle('Clear filter: author');
      fireEvent.click(filterCloseBtn);

      await waitFor(() => expect(unfilteredPushes).toHaveLength(10));
    });
  });

  describe('by failure result', () => {
    test('should have 10 failures', async () => {
      const { getByTitle, findAllByText, queryAllByText } = render(testApp());

      await findAllByText('B');
      const unclassifiedOnlyButton = getByTitle(
        'Loaded failures / toggle filtering for unclassified failures',
      );
      await waitFor(() => findAllByText('yaml'));

      fireEvent.click(unclassifiedOnlyButton);

      // Since yaml is not an unclassified failure, making this call will
      // ensure that the filtering has completed. Then we can get an accurate
      // count of what's left.
      await waitFor(() => {
        expect(queryAllByText('yaml')).toHaveLength(0);
      });
      // The api returns the same joblist for each push.
      // 10 pushes with 2 failures each, but only 1 unclassified.
      expect(jobCount()).toBe(20);

      // undo the filtering and make sure we see all the jobs again
      fireEvent.click(unclassifiedOnlyButton);
      await waitFor(() => findAllByText('yaml'));
      expect(jobCount()).toBe(50);
    });
    test('KeyboardShortcut u: toggle unclassified jobs', async () => {
      const { queryAllByText, getAllByText } = render(testApp());
      const symbolToRemove = 'yaml';
      await waitFor(() => getAllByText(symbolToRemove));
      fireEvent.keyDown(document.body, { key: 'u', keyCode: 85 });

      await waitFor(() => {
        expect(queryAllByText('yaml')).toHaveLength(0);
      });

      expect(jobCount()).toBe(20);
    });
  });

  describe('by keywords', () => {
    beforeAll(() => {
      fetchMock.get(
        getProjectUrl('/jobs/259537372/', 'autoland'),
        Object.values(jobMap)[0],
      );
      fetchMock.get(
        getProjectUrl('/job-log-url/?job_id=259537372', 'autoland'),
        [],
      );
      fetchMock.get(
        getProjectUrl('/performance/data/?job_id=259537372', 'autoland'),
        [],
      );
      fetchMock.get(
        'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ/runs/0/artifacts',
        { artifacts: [] },
      );
      fetchMock.get(getProjectUrl('/note/?job_id=259537372', 'autoland'), []);
      fetchMock.get(
        getProjectUrl('/bug-job-map/?job_id=259537372', 'autoland'),
        [],
      );
      fetchMock.get(
        getProjectUrl('/jobs/259537372/bug_suggestions/', 'autoland'),
        [],
      );
      fetchMock.get(
        getProjectUrl('/jobs/259537372/text_log_errors/', 'autoland'),
        [],
      );
    });

    const setFilterText = (filterField, text) => {
      fireEvent.click(filterField);
      fireEvent.change(filterField, { target: { value: text } });
      fireEvent.keyDown(filterField, { key: 'Enter' });
    };

    test('click signature should have 10 jobs', async () => {
      const { getByTitle, findAllByText } = render(testApp());

      const build = await findAllByText('B');

      fireEvent.mouseDown(build[0]);

      const keywordLink = await waitFor(
        () => getByTitle('Filter jobs containing these keywords'),
        10000,
      );
      expect(keywordLink.getAttribute('href')).toBe(
        '/?repo=autoland&selectedTaskRun=JFVlnwufR7G9tZu_pKM0dQ.0&searchStr=Gecko%2CDecision%2CTask%2Copt%2CGecko%2CDecision%2CTask%2CD',
      );
    });

    test('string "yaml" should have 10 jobs', async () => {
      const { getAllByText, findAllByText, queryAllByText } = render(testApp());
      await findAllByText('B');
      const filterField = document.querySelector('#quick-filter');
      setFilterText(filterField, 'yaml');

      await waitFor(() => {
        expect(queryAllByText('B')).toHaveLength(0);
      });
      expect(jobCount()).toBe(10);

      // undo the filtering and make sure we see all the jobs again
      setFilterText(filterField, null);
      await waitFor(() => getAllByText('B'));
      expect(jobCount()).toBe(50);
    });

    test('KeyboardShortcut f: focus the quick filter input', async () => {
      const { findAllByText } = render(testApp());
      await findAllByText('B');

      const filterField = document.querySelector('#quick-filter');

      fireEvent.keyDown(document, { key: 'f', keyCode: 70 });

      expect(filterField).toBe(document.activeElement);
    });

    test('KeyboardShortcut ctrl+shift+f: clear the quick filter input', async () => {
      const {
        findAllByText,
        getAllByText,
        getByPlaceholderText,
        queryAllByText,
      } = render(testApp());
      await findAllByText('B');
      const filterField = getByPlaceholderText('Filter platforms & jobs');
      setFilterText(filterField, 'yaml');

      await waitFor(() => {
        expect(queryAllByText('B')).toHaveLength(0);
      });

      expect(filterField.value).toEqual('yaml');
      fireEvent.keyDown(document, {
        key: 'f',
        keyCode: 70,
        ctrlKey: true,
        shiftKey: true,
      });

      await waitFor(() => getAllByText('B'));

      expect(filterField.value).toEqual('');
    });
  });

  describe('by result status', () => {
    const clickFilterChicklet = (color) => {
      fireEvent.click(document.querySelector(`.btn-${color}-filter-chicklet`));
    };

    test('uncheck success should leave 30 jobs', async () => {
      const { getAllByText, findAllByText, queryAllByText } = render(testApp());

      await findAllByText('B');
      clickFilterChicklet('green');

      await waitFor(() => {
        expect(queryAllByText('D')).toHaveLength(0);
      });

      expect(jobCount()).toBe(40);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('green');
      await waitFor(() => getAllByText('D'));
      expect(jobCount()).toBe(50);
    });

    test('uncheck failures should leave 20 jobs', async () => {
      const { getAllByText, findAllByText, queryAllByText } = render(testApp());
      const symbolToRemove = 'B';

      await findAllByText(symbolToRemove);
      clickFilterChicklet('red');

      await waitFor(() => {
        expect(queryAllByText(symbolToRemove)).toHaveLength(0);
      });

      expect(jobCount()).toBe(20);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('red');
      await waitFor(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(50);
    });

    test('uncheck in progress should leave 20 jobs', async () => {
      const { getAllByText, findAllByText, queryAllByText } = render(testApp());
      const symbolToRemove = 'yaml';

      await findAllByText('B');
      clickFilterChicklet('dkgray');

      await waitFor(() => {
        expect(queryAllByText(symbolToRemove)).toHaveLength(0);
      });
      expect(jobCount()).toBe(40);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('dkgray');
      await waitFor(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(50);
    });

    test('KeyboardShortcut i: toggle off in-progress tasks', async () => {
      const { getAllByText, queryAllByText } = render(testApp());
      const symbolToRemove = 'yaml';

      await waitFor(() => getAllByText(symbolToRemove));

      fireEvent.keyDown(document.body, { key: 'i', keyCode: 73 });

      await waitFor(() => {
        expect(queryAllByText(symbolToRemove)).toHaveLength(0);
      });

      expect(history.location.search).toEqual(
        '?repo=autoland&resultStatus=testfailed%2Cbusted%2Cexception%2Csuccess%2Cretry%2Cusercancel%2Crunnable',
      );
    });

    test('KeyboardShortcut i: toggle on in-progress tasks', async () => {
      const { getAllByText, findAllByText, queryAllByText } = render(testApp());
      const symbolToRemove = 'yaml';

      await waitFor(() => getAllByText(symbolToRemove));
      clickFilterChicklet('dkgray');

      await waitFor(() => {
        expect(queryAllByText(symbolToRemove)).toHaveLength(0);
      });

      expect(jobCount()).toBe(40);

      await findAllByText('B');
      // undo the filtering and make sure we see all the jobs again

      fireEvent.keyDown(document.body, { key: 'i', keyCode: 73 });
      await findAllByText('B');
      await waitFor(() => getAllByText(symbolToRemove), 5000);
      expect(jobCount()).toBe(50);
      expect(history.location.search).toEqual('?repo=autoland');
    });

    test('Filters | Reset should get back to original set of jobs', async () => {
      const {
        getAllByText,
        findAllByText,
        findByText,
        queryAllByText,
      } = render(testApp());
      const symbolToRemove = 'yaml';

      await findAllByText('B');
      clickFilterChicklet('dkgray');

      await waitFor(() => {
        expect(queryAllByText(symbolToRemove)).toHaveLength(0);
      });
      expect(jobCount()).toBe(40);

      // undo the filtering with the "Filters | Reset" menu item
      const filtersMenu = await findByText('Filters');
      fireEvent.click(filtersMenu);

      const resetMenuItem = await findByText('Reset');
      fireEvent.click(resetMenuItem);

      await waitFor(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(50);
    });
  });
});
