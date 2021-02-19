import { summaryStatusMap, visualMetrics } from '../perfherder/constants';
import { addResultsLink, getFrameworkName } from '../perfherder/helpers';

import JobModel from './job';

export default class FilterAlertsWithVideos {
  constructor(alertSummary, frameworks) {
    this.alertSummary = alertSummary;
    this.framework = getFrameworkName(frameworks, alertSummary.framework);
  }

  async enrichAndRetrieveAlerts() {
    let alerts = [];
    if (
      this.framework === 'browsertime' &&
      this.anyAlertWithVideoResults(this.alertSummary)
    ) {
      alerts = await this.enrichSummaryAlerts(
        this.alertSummary,
        this.alertSummary.repository,
        this.alertSummary.push_id,
        this.alertSummary.prev_push_id,
      );
    }

    return alerts;
  }

  async enrichSummaryAlerts(alertSummary, repo, pushId, prevPushId) {
    const [jobList, prevJobList] = await Promise.all([
      JobModel.getList({ repo, push_id: pushId }, { fetchAll: true }),
      JobModel.getList({ repo, push_id: prevPushId }, { fetchAll: true }),
    ]);

    // add task ids for current rev and previous rev to every relevant alert item
    this.enrichWithLinks(alertSummary, jobList);
    this.enrichWithLinks(alertSummary, prevJobList);

    return alertSummary.alerts;
  }

  containsVismet(title) {
    return visualMetrics.find((metric) => title.includes(metric));
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
      alert.is_regression === true &&
      !this.containsVismet(alert.title)
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
}
