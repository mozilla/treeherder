import fetchMock from 'fetch-mock';
import { cloneDeep } from 'lodash';

import BrowsertimeAlertsExtraData from '../../../ui/models/browsertimeAlertsExtraData';
import testAlertSummaryWithVideos from '../mock/alerts_with_videos/alert_summary_with_browsertime_videos';
import testAlertSummaryWithoutVideos from '../mock/alerts_with_videos/alert_summary_without_browsertime_videos';
import testAlertSummaryNonBrowsertime from '../mock/alerts_with_videos/alert_summary_non_browsertime';
import currentJoblistWithVideoResultsOne from '../mock/alerts_with_videos/current_joblist_with_video_results_page_1';
import currentJoblistWithVideoResultsTwo from '../mock/alerts_with_videos/current_joblist_with_video_results_page_2';
import prevJoblistWithVideoResultsOne from '../mock/alerts_with_videos/prev_joblist_with_video_results_page_1';
import prevJoblistWithVideoResultsTwo from '../mock/alerts_with_videos/prev_joblist_with_video_results_page_2';
import currentJoblistWithoutVideoResultsOne from '../mock/alerts_with_videos/current_joblist_without_video_results_page_1';
import currentJoblistWithoutVideoResultsTwo from '../mock/alerts_with_videos/current_joblist_without_video_results_page_2';
import prevJoblistWithoutVideoResultsOne from '../mock/alerts_with_videos/prev_joblist_without_video_results_page_1';
import prevJoblistWithoutVideoResultsTwo from '../mock/alerts_with_videos/prev_joblist_without_video_results_page_2';
import repos from '../mock/repositories';

const browsertimeProfileUrls = [
  'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/c6nAPFniThOiaGvDT2DNCw/runs/0/artifacts/public/test_info/profile_google-sheets.zip',
  'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/LUjQR22tRp6J4wXLHhYk8g/runs/0/artifacts/public/test_info/profile_google-sheets.zip',
];

describe('BrowsertimeAlertsExtraData', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  describe('File bug url when alerts contain browsertime results links', () => {
    beforeEach(() => {
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=847217`,
        currentJoblistWithVideoResultsOne,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=847217&page=2`,
        currentJoblistWithVideoResultsTwo,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=846998`,
        prevJoblistWithVideoResultsOne,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=846998&page=2`,
        prevJoblistWithVideoResultsTwo,
      );
      // Returns the autoland repo.
      fetchMock.mock(`/api/repository/`, repos);

      for (const profileUrl of browsertimeProfileUrls) {
        fetchMock.mock(profileUrl, { ok: true });
      }
    });

    test('should return alerts with browsertime results links', async () => {
      const alertSummaryWithVideos = cloneDeep(testAlertSummaryWithVideos);
      const alertsWithVideos = new BrowsertimeAlertsExtraData(
        alertSummaryWithVideos,
        [{ id: 13, name: 'browsertime' }],
      );
      const expectedResultsLink =
        'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/c6nAPFniThOiaGvDT2DNCw/runs/0/artifacts/public/test_info/browsertime-results.tgz';
      const expectedPrevResultsLink =
        'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/LUjQR22tRp6J4wXLHhYk8g/runs/0/artifacts/public/test_info/browsertime-results.tgz';

      await alertsWithVideos.enrichAndRetrieveAlerts();
      alertSummaryWithVideos.alerts.forEach((alert) => {
        let erl = expectedResultsLink;
        let eprl = expectedPrevResultsLink;
        if (!alertsWithVideos.shouldHaveVideoLinks(alert)) {
          erl = undefined;
          eprl = undefined;
        }
        expect(alert.results_link).toEqual(erl);
        expect(alert.prev_results_link).toEqual(eprl);
      });
    });

    test('should return alerts with profiler links', async () => {
      const alertSummaryWithVideos = cloneDeep(testAlertSummaryWithVideos);
      const alertsExtraData = new BrowsertimeAlertsExtraData(
        alertSummaryWithVideos,
        [{ id: 13, name: 'browsertime' }],
      );

      await alertsExtraData.enrichAndRetrieveAlerts();
      alertSummaryWithVideos.alerts.forEach((alert) => {
        if (!alertsExtraData.shouldHaveVideoLinks(alert)) {
          return;
        }
        const { suite } = alert.series_signature;
        const expectedResultsLink = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/c6nAPFniThOiaGvDT2DNCw/runs/0/artifacts/public/test_info/profile_${suite}.zip`;
        const expectedPrevResultsLink = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/LUjQR22tRp6J4wXLHhYk8g/runs/0/artifacts/public/test_info/profile_${suite}.zip`;

        expect(alert.profile_url).toEqual(expectedResultsLink);
        expect(alert.prev_profile_url).toEqual(expectedPrevResultsLink);
      });
    });
  });

  describe('File bug url when alerts do not contain browsertime results links', () => {
    beforeEach(() => {
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=851190`,
        currentJoblistWithoutVideoResultsOne,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=851190&page=2`,
        currentJoblistWithoutVideoResultsTwo,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=847398`,
        prevJoblistWithoutVideoResultsOne,
      );
      fetchMock.mock(
        `/api/jobs/?repo=autoland&push_id=847398&page=2`,
        prevJoblistWithoutVideoResultsTwo,
      );
      // Returns the autoland repo.
      fetchMock.mock(`/api/repository/`, repos);
    });

    test('should return alerts without browsertime results links', async () => {
      const alertSummaryWithoutVideos = cloneDeep(
        testAlertSummaryWithoutVideos,
      );
      const alertsWithoutVideos = new BrowsertimeAlertsExtraData(
        alertSummaryWithoutVideos,
        [{ id: 13, name: 'browsertime' }],
      );

      function checkForSingleAlert(alert) {
        if (alertsWithoutVideos.shouldHaveVideoLinks(alert)) {
          return;
        }
        expect(alert.results_link).toBeUndefined();
        expect(alert.prev_results_link).toBeUndefined();
      }
      const alerts = await alertsWithoutVideos.enrichAndRetrieveAlerts();
      // We still have the alerts array for the profiler links, but they
      // shouldn't have results_link and prev_results_link fields.
      alerts.forEach(checkForSingleAlert);
      alertSummaryWithoutVideos.alerts.forEach(checkForSingleAlert);
    });
  });

  describe('File bug url when alerts are not browsertime', () => {
    test('should return alerts without results links', async () => {
      const alertSummaryNonBrowsertime = cloneDeep(
        testAlertSummaryNonBrowsertime,
      );
      const alertsWithoutVideos = new BrowsertimeAlertsExtraData(
        alertSummaryNonBrowsertime,
        [{ id: 13, name: 'browsertime' }],
      );

      const alerts = await alertsWithoutVideos.enrichAndRetrieveAlerts();
      expect(alerts).toStrictEqual([]);
      alertSummaryNonBrowsertime.alerts.forEach((alert) => {
        if (alertsWithoutVideos.shouldHaveVideoLinks(alert)) {
          return;
        }
        expect(alert.results_link).toBeUndefined();
        expect(alert.prev_results_link).toBeUndefined();
      });
    });

    test('should return alerts without profiler links', async () => {
      const alertSummaryNonBrowsertime = cloneDeep(
        testAlertSummaryNonBrowsertime,
      );
      const alertsWithoutVideos = new BrowsertimeAlertsExtraData(
        alertSummaryNonBrowsertime,
        [{ id: 13, name: 'browsertime' }],
      );

      const alerts = await alertsWithoutVideos.enrichAndRetrieveAlerts();
      expect(alerts).toStrictEqual([]);
      alertSummaryNonBrowsertime.alerts.forEach((alert) => {
        if (alertsWithoutVideos.shouldHaveVideoLinks(alert)) {
          return;
        }
        expect(alert.profile_url).toBeUndefined();
        expect(alert.prev_profile_url).toBeUndefined();
      });
    });
  });

  describe('File bug url when alerts do not contain profile artifacts', () => {
    beforeEach(() => {
      for (const profileUrl of browsertimeProfileUrls) {
        // Returning `ok: false` to imitate a 404.
        fetchMock.mock(profileUrl, { ok: false });
      }
    });

    test('should return alerts without profiler links', async () => {
      const alertSummaryNonBrowsertime = cloneDeep(
        testAlertSummaryNonBrowsertime,
      );
      const alertsWithoutVideos = new BrowsertimeAlertsExtraData(
        alertSummaryNonBrowsertime,
        [{ id: 13, name: 'browsertime' }],
      );

      const alerts = await alertsWithoutVideos.enrichAndRetrieveAlerts();
      expect(alerts).toStrictEqual([]);
      alertSummaryNonBrowsertime.alerts.forEach((alert) => {
        if (alertsWithoutVideos.shouldHaveVideoLinks(alert)) {
          return;
        }
        // There should be no profile links because the profile artifacts
        // are not found.
        expect(alert.profile_url).toBeUndefined();
        expect(alert.prev_profile_url).toBeUndefined();
      });
    });
  });
});
