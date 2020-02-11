import React from 'react';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  waitForElement,
  fireEvent,
} from '@testing-library/react';

import JobModel from '../../../../ui/models/job';
import DetailsPanel from '../../../../ui/job-view/details/DetailsPanel';
import jobListFixtureOne from '../../mock/job_list/job_1';
import pushFixture from '../../mock/push_list.json';
import { getApiUrl } from '../../../../ui/helpers/url';
import FilterModel from '../../../../ui/models/filter';
import {
  replaceLocation,
  getProjectUrl,
} from '../../../../ui/helpers/location';
import configureStore from '../../../../ui/job-view/redux/configureStore';
import { setSelectedJob } from '../../../../ui/job-view/redux/stores/selectedJob';
import { setPushes } from '../../../../ui/job-view/redux/stores/pushes';
import reposFixture from '../../mock/repositories';
import KeyboardShortcuts from '../../../../ui/job-view/KeyboardShortcuts';
import { pinJobs } from '../../../../ui/job-view/redux/stores/pinnedJobs';

describe('DetailsPanel', () => {
  const repoName = 'autoland';
  const classificationTypes = [{ id: 1, name: 'intermittent' }];
  const classificationMap = { 1: 'intermittent' };
  const filterModel = new FilterModel();
  let jobList = null;
  let store = null;
  const currentRepo = reposFixture[2];
  currentRepo.getRevisionHref = () => 'foo';
  currentRepo.getPushLogHref = () => 'foo';

  beforeEach(async () => {
    fetchMock.get(
      getApiUrl('/jobs/?push_id=511138', repoName),
      jobListFixtureOne,
    );
    jobList = await JobModel.getList({ push_id: 511138 });

    fetchMock.get(getProjectUrl('/jobs/259537372/', repoName), jobList.data[1]);
    fetchMock.get(getProjectUrl('/note/?job_id=259537372', repoName), []);
    fetchMock.get(
      getProjectUrl('/jobs/259537372/text_log_steps/', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/jobs/259537372/bug_suggestions/', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/bug-job-map/?job_id=259537372', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/performance/data/?job_id=259537372', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/job-log-url/?job_id=259537372', 'autoland'),
      [],
    );
    fetchMock.get(getApiUrl('/jobdetail/?job_id=259537372'), { results: [] });

    store = configureStore().store;
    store.dispatch(setPushes(pushFixture.results, {}));
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    replaceLocation({});
  });

  const testDetailsPanel = store => (
    <div id="global-container" className="height-minus-navbars">
      <Provider store={store}>
        <KeyboardShortcuts
          filterModel={filterModel}
          showOnScreenShortcuts={() => {}}
        >
          <div />
          <div id="th-global-content" data-testid="global-content">
            <DetailsPanel
              currentRepo={currentRepo}
              user={{ isLoggedIn: false }}
              resizedHeight={100}
              classificationTypes={classificationTypes}
              classificationMap={classificationMap}
            />
          </div>
        </KeyboardShortcuts>
      </Provider>
    </div>
  );

  test('pin selected job with button', async () => {
    const { getByTitle } = render(testDetailsPanel(store));
    store.dispatch(setSelectedJob(jobList.data[1], true));

    fireEvent.click(await waitForElement(() => getByTitle('Pin job')));

    expect(
      await waitForElement(() => getByTitle('Unpin job')),
    ).toBeInTheDocument();
    const pinnedJob = await waitForElement(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    // Verify the pinned job is a descendent of the pinned-job-list
    expect(pinnedJob.closest('#pinned-job-list')).toBeInTheDocument();
  });

  test('pin selected job with keyboard', async () => {
    const { getByTitle, getByTestId } = render(testDetailsPanel(store));
    store.dispatch(setSelectedJob(jobList.data[1], true));

    const hotkeys = await waitForElement(() => getByTestId('hot-keys-id'));
    const keyDownEvent = new Event('keydown');
    keyDownEvent.keyCode = 32;
    keyDownEvent.key = 'Space';

    hotkeys.focus();
    hotkeys.dispatchEvent(keyDownEvent);

    const pinnedJob = await waitForElement(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    // Verify the pinned job is a descendent of the pinned-job-list
    expect(pinnedJob.closest('#pinned-job-list')).toBeInTheDocument();
  });

  test('clear Pinboard', async () => {
    const { getByTitle, getByText } = render(testDetailsPanel(store));
    store.dispatch(setSelectedJob(jobList.data[1], true));

    fireEvent.click(await waitForElement(() => getByTitle('Pin job')));

    const unPinJobBtn = await waitForElement(() => getByTitle('Unpin job'));
    expect(unPinJobBtn).toBeInTheDocument();
    const pinnedJob = await waitForElement(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    fireEvent.click(getByTitle('Additional pinboard functions'));
    fireEvent.click(getByText('Clear all'));

    expect(pinnedJob).not.toBeInTheDocument();
  });

  test('pin all jobs', async () => {
    const { queryAllByTitle } = render(testDetailsPanel(store));
    store.dispatch(pinJobs(jobList.data));

    const unPinJobBtns = await waitForElement(() =>
      queryAllByTitle('Unpin job'),
    );
    expect(unPinJobBtns).toHaveLength(4);
  });
});
