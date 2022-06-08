import { summaryStatusMap } from '../perfherder/perf-helpers/constants';
import {
  getResultsLink,
  getFrameworkName,
} from '../perfherder/perf-helpers/helpers';
import { getArtifactsUrl } from '../helpers/url';

import RepositoryModel from './repository';

export default class BrowsertimeAlertsExtraData {
  constructor(alertSummary, frameworks) {
    this.alertSummary = alertSummary;
    this.framework = getFrameworkName(frameworks, alertSummary.framework);
  }

  async enrichAndRetrieveAlerts() {
    let alerts = [];
    if (this.framework === 'browsertime') {
      alerts = await this.enrichSummaryAlerts(this.alertSummary);
    }

    return alerts;
  }

  async enrichSummaryAlerts(alertSummary) {
    if (this.anyAlertWithVideoResults(this.alertSummary)) {
      // add task ids for current rev and previous rev to every relevant alert item
      this.enrichWithLinks(alertSummary);
    }

    const alertsRepo = await this.getAlertsRepo();
    await this.enrichWithProfileLinks(alertSummary, alertsRepo);

    return alertSummary.alerts;
  }

  anyAlertWithVideoResults(alertSummary) {
    // For the moment the browsertime vismet are separate from the pageload ones
    // that's why we need to filter them out. Also, we're retrieving the video results
    // for regressions only
    const any = alertSummary.alerts.filter((alert) =>
      this.shouldHaveVideoLinks(alert),
    );
    return any.length > 0;
  }

  shouldHaveVideoLinks(alert) {
    return (
      alert.status !== summaryStatusMap.reassigned &&
      alert.status !== summaryStatusMap.downstream &&
      alert.status !== summaryStatusMap.invalid &&
      alert.is_regression === true
    );
  }

  enrichWithLinks(alertSummary) {
    alertSummary.alerts.forEach((alert) => {
      if (this.shouldHaveVideoLinks(alert)) {
        if (alert.taskcluster_metadata) {
          alert.results_link = getResultsLink(
            alert.taskcluster_metadata.task_id,
          );
        }
        if (alert.prev_taskcluster_metadata) {
          alert.prev_results_link = getResultsLink(
            alert.prev_taskcluster_metadata.task_id,
          );
        }
      }
    });
  }

  async getAlertsRepo() {
    const repos = await RepositoryModel.getList();
    return RepositoryModel.getRepo(this.alertSummary.repository, repos);
  }

  async enrichWithProfileLinks(alertSummary, repo) {
    let alertLinks = alertSummary.alerts.map((alert) => {
      if (alert.taskcluster_metadata && alert.prev_taskcluster_metadata) {
        const { suite } = alert.series_signature;

        const currentUrl = getArtifactsUrl({
          taskId: alert.taskcluster_metadata.task_id,
          run: alert.taskcluster_metadata.retry_id,
          rootUrl: repo.tc_root_url,
          artifactPath: `public/test_info/profile_${suite}.zip`,
        });
        const prevUrl = getArtifactsUrl({
          taskId: alert.prev_taskcluster_metadata.task_id,
          run: alert.prev_taskcluster_metadata.retry_id,
          rootUrl: repo.tc_root_url,
          artifactPath: `public/test_info/profile_${suite}.zip`,
        });

        // We check the artifacts with `method: 'HEAD'` which means that it
        // doesn't download the whole file and only gets the headers. We can see
        // if artifact is available or not using the headers.
        const currentPromise = fetch(currentUrl, {
          method: 'HEAD',
        });
        const prevPromise = fetch(prevUrl, {
          method: 'HEAD',
        });
        return { alert, currentPromise, prevPromise, currentUrl, prevUrl };
      }
      return null;
    });

    // Keep only the alerts that have a job and url. Filter out the nulls.
    alertLinks = alertLinks.filter((a) => a);

    // We don't await in the loop above because we don't want to block the loop
    // on each iteration. Promise.all will properly parallelize the requests.
    const currentPromiseResults = await Promise.all(
      alertLinks.map((a) => a.currentPromise),
    );
    const prevPromiseResults = await Promise.all(
      alertLinks.map((a) => a.prevPromise),
    );

    // Now we know if the artifacts are available or not, we can add the links
    // to the alerts.
    for (let i = 0; i < alertLinks.length; i++) {
      const { alert, currentUrl, prevUrl } = alertLinks[i];
      const currentPromiseResult = currentPromiseResults[i];
      const prevPromiseResult = prevPromiseResults[i];

      if (currentPromiseResult.ok) {
        alert.profile_url = currentUrl;
      }
      if (prevPromiseResult.ok) {
        alert.prev_profile_url = prevUrl;
      }
    }
  }
}
