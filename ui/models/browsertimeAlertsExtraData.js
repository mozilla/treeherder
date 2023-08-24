import { summaryStatusMap } from '../perfherder/perf-helpers/constants';
import {
  addResultsLink,
  getFrameworkName,
} from '../perfherder/perf-helpers/helpers';
import { getArtifactsUrl } from '../helpers/url';

import JobModel from './job';
import RepositoryModel from './repository';

export default class BrowsertimeAlertsExtraData {
  constructor(alertSummary, frameworks) {
    this.alertSummary = alertSummary;
    this.framework = getFrameworkName(frameworks, alertSummary.framework);
  }

  async enrichAndRetrieveAlerts() {
    let alerts = [];
    if (this.framework === 'browsertime') {
      alerts = await this.enrichSummaryAlerts(
        this.alertSummary,
        this.alertSummary.repository,
        this.alertSummary.push_id,
        this.alertSummary.prev_push_id,
      );
    }

    return alerts;
  }

  async enrichSummaryAlerts(
    alertSummary,
    repo,
    pushId,
    prevPushId,
  ) {
    let start = performance.now();
    let [jobList, prevJobList] = [[], []];
    console.log(`Without fetch: ${performance.now() - start}`);
    start = performance.now();
    [jobList, prevJobList] = await Promise.all([
      JobModel.getList({ repo, push_id: pushId }, { fetchAll: true }),
      JobModel.getList({ repo, push_id: prevPushId }, { fetchAll: true }),
    ]);
    console.log(`With fetch: ${performance.now() - start}`);

    if (this.anyAlertWithVideoResults(this.alertSummary)) {
      // add task ids for current rev and previous rev to every relevant alert item
      this.enrichWithLinks(alertSummary, jobList);
      this.enrichWithLinks(alertSummary, prevJobList);
    }

    const alertsRepo = await this.getAlertsRepo();
    await this.enrichWithProfileLinks(alertSummary, alertsRepo, jobList);
    await this.enrichWithProfileLinks(alertSummary, alertsRepo, prevJobList);

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

  enrichWithLinks(alertSummary, jobList) {
    alertSummary.alerts.forEach((alert) => {
      if (this.shouldHaveVideoLinks(alert)) {
        const job = jobList.data.find(
          (j) =>
            j.searchStr.includes(alert.series_signature.suite) &&
            j.searchStr.includes(alert.series_signature.machine_platform) &&
            j.resultStatus === 'success',
        );

        if (job) {
          if (alertSummary.revision === job.push_revision) {
            alert.results_link = addResultsLink(job.task_id);
          }
          if (alertSummary.prev_push_revision === job.push_revision) {
            alert.prev_results_link = addResultsLink(job.task_id);
          }
        }
      }
    });
  }

  async getAlertsRepo() {
    const repos = await RepositoryModel.getList();
    return RepositoryModel.getRepo(this.alertSummary.repository, repos);
  }

  async enrichWithProfileLinks(alertSummary, repo, jobList) {
    let alertLinks = alertSummary.alerts.map((alert) => {
      const job = jobList.data.find(
        (j) =>
          j.searchStr.includes(alert.series_signature.suite) &&
          j.searchStr.includes(alert.series_signature.machine_platform) &&
          j.resultStatus === 'success',
      );

      if (job) {
        const { suite } = alert.series_signature;

        const url = getArtifactsUrl({
          taskId: job.task_id,
          run: job.retry_id,
          rootUrl: repo.tc_root_url,
          artifactPath: `public/test_info/profile_${suite}.zip`,
        });

        // We check the artifacts with `method: 'HEAD'` which means that it
        // doesn't download the whole file and only gets the headers. We can see
        // if artifact is available or not using the headers.
        const promise = fetch(url, {
          method: 'HEAD',
        });
        return { alert, job, promise, url };
      }
      return null;
    });

    // Keep only the alerts that have a job and url. Filter out the nulls.
    alertLinks = alertLinks.filter((a) => a);

    // We don't await in the loop above because we don't want to block the loop
    // on each iteration. Promise.all will properly parallelize the requests.
    const promiseResults = await Promise.all(alertLinks.map((a) => a.promise));

    // Now we know if the artifacts are available or not, we can add the links
    // to the alerts.
    for (let i = 0; i < alertLinks.length; i++) {
      const { alert, job, url } = alertLinks[i];
      const promiseResult = promiseResults[i];

      if (promiseResult.ok) {
        // Add profile urls to the alert only if the artifact is present.
        if (job.push_revision === alertSummary.revision) {
          alert.profile_url = url;
        }

        if (job.push_revision === alertSummary.prev_push_revision) {
          alert.prev_profile_url = url;
        }
      }
    }
  }
}
