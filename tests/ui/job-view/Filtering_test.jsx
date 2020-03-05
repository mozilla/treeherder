import React from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import App from '../../../ui/job-view/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import {
  getProjectUrl,
  replaceLocation,
  setUrlParam,
} from '../../../ui/helpers/location';
import jobListFixtureOne from '../mock/job_list/job_1';
import jobMap from '../mock/job_map';

// solution to createRange is not a function error for popper (used by reactstrap)
// https://github.com/mui-org/material-ui/issues/15726#issuecomment-493124813
global.document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: {
    nodeName: 'BODY',
    ownerDocument: document,
  },
});

describe('Filtering', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    // ``begin:`` here will match any fetch call to an API that begins with
    // this string.
    fetchMock.get('begin:https://treestatus.mozilla-releng.net/trees/', {
      result: {
        message_of_the_day: '',
        reason: '',
        status: 'open',
        tree: repoName,
      },
    });
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );

    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', 'try'), {
      results: [
        {
          id: 111111,
          revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
          author: 'whozat@gmail.com',
          revision_count: 1,
          push_timestamp: 1562867957,
          repository_id: 4,
          revisions: [
            {
              repository_id: 4,
              revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
              author: 'whozat <whozat@gmail.com>',
              comments: 'didathing',
            },
          ],
        },
      ],
    });
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, jobListFixtureOne);
  });

  afterEach(() => {
    cleanup();
    replaceLocation({});
  });

  const jobCount = () => document.querySelectorAll('.job-btn').length;

  describe('by author', () => {
    beforeEach(() => {
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
      const { getAllByText, getAllByTestId, getByTestId } = render(<App />);
      // wait till the ``reviewbot`` authored push is shown before filtering.
      await waitForElement(() => getAllByText('reviewbot'));
      setUrlParam('author', 'reviewbot');
      await waitForElementToBeRemoved(() => getByTestId('push-511138'));

      const filteredPushes = await waitForElement(() =>
        getAllByTestId('push-header'),
      );
      expect(filteredPushes).toHaveLength(1);

      setUrlParam('author', null);
      await waitForElement(() => getAllByText('jarilvalenciano@gmail.com'));
      const unFilteredPushes = await waitForElement(() =>
        getAllByTestId('push-header'),
      );
      expect(unFilteredPushes).toHaveLength(10);
    });
  });

  describe('by failure result', () => {
    beforeEach(() => {
      // polling..  Return nothing...
      fetchMock.get(
        `begin:${getProjectUrl(
          '/push/?full=true&count=11&push_timestamp__lte=',
          'autoland',
        )}`,
        {
          results: [],
        },
      );
    });

    test('should have 10 failures', async () => {
      const { getAllByText, getByTitle, findAllByText } = render(<App />);
      await waitForElement(() => findAllByText('B'));
      const unclassifiedOnlyButton = getByTitle(
        'Loaded failures / toggle filtering for unclassified failures',
      );
      fireEvent.click(unclassifiedOnlyButton);

      // Since yaml is not an unclassified failure, making this call will
      // ensure that the filtering has completed. Then we can get an accurate
      // count of what's left.
      await waitForElementToBeRemoved(() => getAllByText('yaml'));

      // The api returns the same joblist for each push.
      // 10 pushes with 2 failures each, but only 1 unclassified.
      expect(jobCount()).toBe(10);

      // undo the filtering and make sure we see all the jobs again
      fireEvent.click(unclassifiedOnlyButton);
      await waitForElement(() => getAllByText('yaml'));
      expect(jobCount()).toBe(40);
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
      fetchMock.get(getApiUrl('/jobdetail/?job_id=259537372'), { results: [] });
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
        getProjectUrl('/jobs/259537372/text_log_steps/', 'autoland'),
        [],
      );
    });

    const setFilterText = (filterField, text) => {
      fireEvent.click(filterField);
      fireEvent.change(filterField, { target: { value: text } });
      fireEvent.keyDown(filterField, { key: 'Enter' });
    };

    test('string "yaml" should have 10 jobs', async () => {
      const { getAllByText, findAllByText } = render(<App />);
      await waitForElement(() => findAllByText('B'));
      const filterField = document.querySelector('#quick-filter');
      setFilterText(filterField, 'yaml');

      await waitForElementToBeRemoved(() => getAllByText('B'));
      expect(jobCount()).toBe(10);

      // undo the filtering and make sure we see all the jobs again
      setFilterText(filterField, null);
      await waitForElement(() => getAllByText('B'));
      expect(jobCount()).toBe(40);
    });

    test('click signature should have 10 jobs', async () => {
      const { getByText, getByTitle, findAllByText } = render(<App />);
      const build = await waitForElement(() => findAllByText('B'));

      fireEvent.mouseDown(build[0]);
      const sigLink = await waitForElement(() => getByText('(sig)'));
      expect(sigLink.getAttribute('href')).toBe(
        '/#/jobs?repo=autoland&selectedJob=259537372&searchStr=2aa083621bb989d6acf1151667288d5fe9616178',
      );

      const keywordLink = await waitForElement(() =>
        getByTitle('Filter jobs containing these keywords'),
      );
      expect(keywordLink.getAttribute('href')).toBe(
        '/#/jobs?repo=autoland&selectedJob=259537372&searchStr=Gecko%2CDecision%2CTask%2Copt%2CGecko%2CDecision%2CTask%2C%28D%29',
      );
    });
  });

  describe('by result status', () => {
    const clickFilterChicklet = color => {
      fireEvent.click(document.querySelector(`.btn-${color}-filter-chicklet`));
    };

    test('uncheck success should leave 30 jobs', async () => {
      const { getAllByText, findAllByText } = render(<App />);
      await waitForElement(() => findAllByText('B'));
      clickFilterChicklet('green');

      await waitForElementToBeRemoved(() => getAllByText('D'));
      expect(jobCount()).toBe(30);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('green');
      await waitForElement(() => getAllByText('D'));
      expect(jobCount()).toBe(40);
    });

    test('uncheck failures should leave 20 jobs', async () => {
      const { getAllByText, findAllByText } = render(<App />);
      const symbolToRemove = 'B';
      await waitForElement(() => findAllByText(symbolToRemove));
      clickFilterChicklet('red');

      await waitForElementToBeRemoved(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(20);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('red');
      await waitForElement(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(40);
    });

    test('uncheck in progress should leave 20 jobs', async () => {
      const { getAllByText, findAllByText } = render(<App />);
      const symbolToRemove = 'yaml';
      await waitForElement(() => findAllByText('B'));
      clickFilterChicklet('dkgray');

      await waitForElementToBeRemoved(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(30);

      // undo the filtering and make sure we see all the jobs again
      clickFilterChicklet('dkgray');
      await waitForElement(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(40);
    });

    test('Filters | Reset should get back to original set of jobs', async () => {
      const { getAllByText, findAllByText, findByText } = render(<App />);
      const symbolToRemove = 'yaml';
      await waitForElement(() => findAllByText('B'));
      clickFilterChicklet('dkgray');

      await waitForElementToBeRemoved(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(30);

      // undo the filtering with the "Filters | Reset" menu item
      const filtersMenu = await findByText('Filters');
      fireEvent.click(filtersMenu);

      const resetMenuItem = await waitForElement(() => findByText('Reset'));
      fireEvent.click(resetMenuItem);

      await waitForElement(() => getAllByText(symbolToRemove));
      expect(jobCount()).toBe(40);
    });
  });
});
