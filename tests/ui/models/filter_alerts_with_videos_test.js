import fetchMock from 'fetch-mock';
import { cloneDeep } from 'lodash';

import FilterAlertsWithVideos from '../../../ui/models/filterAlertsWithVideos';
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

describe('FilterAlertsWithVideos', () => {
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
    });

    test('should return alerts with browsertime results links', async () => {
      const alertSummaryWithVideos = cloneDeep(testAlertSummaryWithVideos);
      const alertsWithVideos = new FilterAlertsWithVideos(
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
    });

    test('should return alerts without browsertime results links', async () => {
      const alertSummaryWithoutVideos = cloneDeep(
        testAlertSummaryWithoutVideos,
      );
      const alertsWithoutVideos = new FilterAlertsWithVideos(
        alertSummaryWithoutVideos,
        [{ id: 13, name: 'browsertime' }],
      );

      const alerts = await alertsWithoutVideos.enrichAndRetrieveAlerts();
      expect(alerts).toStrictEqual([]);
      alertSummaryWithoutVideos.alerts.forEach((alert) => {
        if (alertsWithoutVideos.shouldHaveVideoLinks(alert)) {
          return;
        }
        expect(alert.results_link).toBeUndefined();
        expect(alert.prev_results_link).toBeUndefined();
      });
    });
  });

  describe('File bug url when alerts are not browsertime', () => {
    test('should return alerts without results links', async () => {
      const alertSummaryNonBrowsertime = cloneDeep(
        testAlertSummaryNonBrowsertime,
      );
      const alertsWithoutVideos = new FilterAlertsWithVideos(
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
  });
});
