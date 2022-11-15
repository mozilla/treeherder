import numeral from 'numeral';
import sortBy from 'lodash/sortBy';

import { thBaseUrl, uiPerfherderBase } from '../../helpers/url';

import { alertStatusMap } from './constants';
import { getFrameworkName, getGraphsURL, getTimeRange } from './helpers';
import { Perfdocs } from './perfdocs';

export default class TextualSummary {
  constructor(
    frameworks,
    alerts,
    alertSummary,
    copySummary = null,
    alertsWithVideos = [],
  ) {
    this.frameworks = frameworks;
    this.alerts = alerts;
    this.alertSummary = alertSummary;
    this.copySummary = copySummary;
    this.alertsWithVideos = alertsWithVideos;
    this.ellipsesRow = `\n|...|...|...|...|...|`;
  }

  get markdown() {
    let resultStr = '';
    const improved = sortBy(
      this.alerts.filter((alert) => !alert.is_regression),
      'amount_pct',
    ).reverse();
    const regressed = sortBy(
      this.alerts.filter(
        (alert) =>
          alert.is_regression && alert.status !== alertStatusMap.invalid,
      ),
      'amount_pct',
    ).reverse();

    const regressionsTable = this.getFormattedRegressions(regressed);
    resultStr += regressionsTable;
    const improvementsTable = this.getFormattedImprovements(improved);
    resultStr += improvementsTable;

    if (this.copySummary) {
      resultStr = this.attachSummaryHeaderAndAlertLink(resultStr);
    }

    return resultStr;
  }

  attachSummaryHeaderAndAlertLink = (resultStr) => {
    // add summary header if getting text for clipboard only
    const created = new Date(this.alertSummary.created);
    const summaryHeader = `== Change summary for alert #${
      this.alertSummary.id
    } (as of ${created.toUTCString()}) ==\n`;
    resultStr = summaryHeader + resultStr;
    // include link to alert if getting text for clipboard only
    const alertLink = `${window.location.origin}/perfherder/alerts?id=${this.alertSummary.id}`;
    resultStr += `\nFor up to date results, see: ${alertLink}`;
    return resultStr;
  };

  formatAlert(alert) {
    const numFormat = '0,0.00';
    let amountPct;
    const { repository, framework } = this.alertSummary;
    const timeRange = getTimeRange(this.alertSummary);
    const baseURL = thBaseUrl + uiPerfherderBase.slice(1);
    const graphLink =
      baseURL + getGraphsURL(alert, timeRange, repository, framework).slice(1);
    if (alert.amount_pct.toFixed(0) === '0') {
      // have extra fraction digits when rounding ends up with 0%
      amountPct = alert.amount_pct.toFixed(2);
    } else {
      amountPct = alert.amount_pct.toFixed(0);
    }

    const prevValue = numeral(alert.prev_value).format(numFormat);
    const newValue = numeral(alert.new_value).format(numFormat);

    const { suite, test, machine_platform: platform } = alert.series_signature;
    const extraOptions = alert.series_signature.extra_options.join(' ');

    const updatedAlert = this.alertsWithVideos.find((a) => alert.id === a.id);
    const frameworkName = getFrameworkName(
      this.frameworks,
      this.alertSummary.framework,
    );
    const perfdocs = new Perfdocs(frameworkName, suite, platform);
    const url = perfdocs.documentationURL;
    const suiteName = perfdocs.hasDocumentation()
      ? `[${suite}](${url})`
      : suite;
    const suiteTestName = suite === test ? suiteName : `${suiteName} ${test}`;

    if (
      updatedAlert &&
      updatedAlert.results_link &&
      updatedAlert.prev_results_link
    ) {
      return `| [${amountPct}%](${graphLink}) | ${suiteTestName} | ${platform} | ${extraOptions} | [${prevValue}](${updatedAlert.prev_results_link}) -> [${newValue}](${updatedAlert.results_link}) |`;
    }
    return `| [${amountPct}%](${graphLink})  | ${suiteTestName} | ${platform} | ${extraOptions} | ${prevValue} -> ${newValue} |`;
  }

  formatAlertBulk(alerts) {
    return alerts.map((alert) => this.formatAlert(alert, alerts)).join('\n');
  }

  getFormattedRegressions(regressed) {
    let resultStr = '';
    if (regressed.length > 0 && regressed.length <= 15) {
      // add a newline if we displayed the header
      if (this.copySummary) {
        resultStr += '\n';
      }
      const formattedRegressions = this.formatAlertBulk(regressed);
      resultStr += `### Regressions:\n\n| **Ratio** | **Test** | **Platform** | **Options** | **Absolute values (old vs new)**| \n|--|--|--|--|--| \n${formattedRegressions}\n`;
    }
    if (regressed.length > 15) {
      // add a newline if we displayed the header
      if (this.copySummary) {
        resultStr += '\n';
      }
      const sortedRegressed = regressed.sort(
        (a, b) => b.amount_pct - a.amount_pct,
      );
      const biggestTenRegressed = sortedRegressed.slice(0, 10);
      const smallestFiveRegressed = sortedRegressed.slice(-5);
      const formattedBiggestRegressions =
        this.formatAlertBulk(biggestTenRegressed);
      const formattedSmallestRegressions = this.formatAlertBulk(
        smallestFiveRegressed,
      );

      resultStr += `### Regressions:\n\n| **Ratio** | **Test** | **Platform** | **Options** | **Absolute values (old vs new)**| \n|--|--|--|--|--| \n${formattedBiggestRegressions}`;
      resultStr += this.ellipsesRow;
      resultStr += `\n${formattedSmallestRegressions}\n`;
    }
    return resultStr;
  }

  getFormattedImprovements(improved) {
    let resultStr = '';
    if (improved.length > 0 && improved.length <= 6) {
      // Add a newline if we displayed some regressions
      if (resultStr.length > 0) {
        resultStr += '\n';
      }
      const formattedImprovements = this.formatAlertBulk(improved);
      resultStr += `### Improvements:\n\n| **Ratio** | **Test** | **Platform** | **Options** | **Absolute values (old vs new)**| \n|--|--|--|--|--| \n${formattedImprovements}\n`;
    } else if (improved.length > 6) {
      // Add a newline if we displayed some regressions
      if (resultStr.length > 0) {
        resultStr += '\n';
      }
      const sortedImproved = improved.sort(
        (a, b) => b.amount_pct - a.amount_pct,
      );
      const biggestFiveImprovements = sortedImproved.slice(0, 5);
      const smallestImprovement = sortedImproved.slice(-1);
      const formattedBiggestImprovements = this.formatAlertBulk(
        biggestFiveImprovements,
      );
      const formattedSmallestImprovement =
        this.formatAlertBulk(smallestImprovement);

      resultStr += `### Improvements:\n\n| **Ratio** | **Test** | **Platform** | **Options** | **Absolute values (old vs new)**| \n|--|--|--|--|--| \n${formattedBiggestImprovements}`;
      resultStr += this.ellipsesRow;
      resultStr += `\n${formattedSmallestImprovement}\n`;
    }
    return resultStr;
  }
}
