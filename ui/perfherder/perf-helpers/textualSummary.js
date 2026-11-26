import sortBy from 'lodash/sortBy';

import {
  thBaseUrl,
  getPerfAnalysisUrl,
  getPerfCompareBaseURL,
} from '../../helpers/url';

import { alertStatusMap } from './constants';
import {
  formatPercent,
  getFrameworkName,
  getGraphsURL,
  getTimeRange,
} from './helpers';
import { Perfdocs } from './perfdocs';

// Options enabled by default on every platform, listing them is just noise
const defaultOptions = ['e10s', 'stylo', 'webrender'];
// Fission is only enabled by default on desktop
const defaultDesktopOptions = ['fission'];

const graphZoomDays = 3;

// the word joiner stops a line break after the hyphen
export const valueSeparator = '\u00a0-\u2060>\u00a0';

const valueSuffixes = [
  { scale: 1e9, suffix: 'G' },
  { scale: 1e6, suffix: 'M' },
  { scale: 1e3, suffix: 'K' },
];

// at most 5 significant digits, with K/M/G, so cells don't wrap
export const formatAlertValue = (value, precision = 5) => {
  // check the rounded value so e.g. 999,999.9 becomes 1M instead of 1000K
  const { scale, suffix } = valueSuffixes.find(
    (item) =>
      Number((Math.abs(value) / item.scale).toPrecision(precision)) >= 1,
  ) || { scale: 1, suffix: '' };

  return `${Number((value / scale).toPrecision(precision))}${suffix}`;
};

// the Change column has the exact difference
const beforeAfterPrecision = 3;

// a non-breaking space keeps the value and unit together
export const formatValueWithUnit = (value, unit, precision = 5) => {
  const formatted = formatAlertValue(value, precision);
  if (!unit) return formatted;
  return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
};

const pluralize =(count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// e.g. "**26 regressions and 12 improvements** on 7 talos tests across 3 platforms"
export const getChangesSummary = (regressed, improved, frameworkName = '') => {
  const alerts = [...regressed, ...improved];
  if (alerts.length === 0) {
    // keeps the first line of comment 0 a full sentence
    return `${frameworkName ? `${frameworkName} ` : ''}performance changes`;
  }
  const countDistinct = (field) =>
    new Set(alerts.map((alert) => alert.series_signature[field])).size;
  const counts = [
    ...(regressed.length ? [pluralize(regressed.length, 'regression')] : []),
    ...(improved.length ? [pluralize(improved.length, 'improvement')] : []),
  ].join(' and ');
  const testCount = countDistinct('suite');
  const tests = `${testCount} ${frameworkName ? `${frameworkName} ` : ''}test${
    testCount === 1 ? '' : 's'
  }`;

  return `**${counts}** on ${tests} across ${pluralize(
    countDistinct('machine_platform'),
    'platform',
  )}`;
};

// the API rounds tiny values, so trust the regression direction when they look equal
export const getChangeArrow = (alert) => {
  const { lower_is_better: lowerIsBetter } = alert.series_signature || {};
  if (typeof lowerIsBetter === 'boolean') {
    return alert.is_regression === lowerIsBetter ? '▲' : '▼';
  }
  if (alert.new_value > alert.prev_value) return '▲';
  if (alert.new_value < alert.prev_value) return '▼';
  return '';
};

// difference of the rounded values, so it matches the values next to it
export const getAbsoluteChange = (alert) => {
  const { measurement_unit: unit } = alert.series_signature;
  const round = (value) => Number(value.toPrecision(beforeAfterPrecision));
  // round again to hide floating point noise, e.g. 15.4 - 15.6
  const change = Number(
    (round(alert.new_value) - round(alert.prev_value)).toPrecision(12),
  );
  if (change === 0) return formatValueWithUnit(0, unit);
  const sign = change > 0 ? '+' : '-';
  return `${sign}${formatValueWithUnit(Math.abs(change), unit)}`;
};

export const getAlertOptions = (alert) => {
  const { extra_options: extraOptions = [], machine_platform: platform } =
    alert.series_signature;
  const hiddenOptions = platform.includes('android')
    ? defaultOptions
    : [...defaultOptions, ...defaultDesktopOptions];

  return extraOptions.filter((option) => !hiddenOptions.includes(option));
};

const getOptionsText = (alert) => getAlertOptions(alert).join(', ') || '-';

// Long tables only show the biggest and the smallest few changes
const tableLimits = {
  regression: { biggest: 10, smallest: 5 },
  improvement: { biggest: 5, smallest: 1 },
};

export const getTableRows = (sortedAlerts, { biggest, smallest }) => {
  if (sortedAlerts.length <= biggest + smallest) {
    return { biggestRows: sortedAlerts, smallestRows: [], hiddenCount: 0 };
  }
  return {
    biggestRows: sortedAlerts.slice(0, biggest),
    smallestRows: sortedAlerts.slice(-smallest),
    hiddenCount: sortedAlerts.length - biggest - smallest,
  };
};

// Days of data before and after the alerting push in the agent data URLs
const seriesDataDays = 14;
const dayInMs = 24 * 60 * 60 * 1000;

const phabricatorPattern =
  /Differential Revision: (https:\/\/phabricator\.services\.mozilla\.com\/D\d+)/;

export const getAgentCommit = (commit, repoModel = null) => {
  const { revision, author = null, comments = '' } = commit;
  const [title = ''] = comments.split('\n');
  const bug = title.match(/\bBug (\d+)/i);
  const isGit = repoModel?.dvcs_type === 'git';
  return {
    revision,
    author,
    title,
    bug: bug ? Number(bug[1]) : null,
    phabricator_url: comments.match(phabricatorPattern)?.[1] || null,
    diff_url: repoModel ? repoModel.getRevisionHref(revision) : null,
    raw_diff_url: repoModel
      ? `${repoModel.url}/${isGit ? 'commit' : 'raw-rev'}/${revision}${
          isGit ? '.diff' : ''
        }`
      : null,
  };
};

export const getAgentAttachmentName = (alertSummaryId) =>
  `perf-alert-${alertSummaryId}.json`;

export default class TextualSummary {
  constructor(
    frameworks,
    alerts,
    alertSummary,
    copySummary = null,
    browsertimeAlertsExtraData = [],
  ) {
    this.frameworks = frameworks;
    this.alerts = alerts;
    this.alertSummary = alertSummary;
    this.copySummary = copySummary;
    this.browsertimeAlertsExtraData = browsertimeAlertsExtraData;
    this.hasProfileUrls = this.browsertimeAlertsExtraData.some(
      (a) => a.profile_url && a.prev_profile_url,
    );
    this.hasOptions = this.alerts.some(
      (alert) => getAlertOptions(alert).length > 0,
    );
  }

  getTableHeader() {
    const columns = [
      // the "### Regressions" or "### Improvements" heading names the table
      '%',
      'Test : Subtest',
      'Before -> After',
      'Change',
      'Platform',
      ...(this.hasOptions ? ['Options'] : []),
      ...(this.hasProfileUrls ? ['Performance Profiles'] : []),
    ];
    const headers = columns.map((column) => `**${column}**`).join(' | ');
    return `\n\n| ${headers} |\n|${':--|'.repeat(columns.length)}\n`;
  }

  getGraphLink(alert) {
    const { repository, framework, push_timestamp: pushTimestamp } =
      this.alertSummary;
    const timeRange = getTimeRange(this.alertSummary);
    // zoom in around the alerting push so the regressing commit is easy to spot
    const zoomOffset = graphZoomDays * 24 * 60 * 60 * 1000;
    const pushTime = pushTimestamp * 1000;
    // pad the y range well beyond the values so noisy points stay visible
    const low = Math.min(alert.prev_value, alert.new_value);
    const high = Math.max(alert.prev_value, alert.new_value);
    const padding = Math.max((high - low) * 2, high * 0.15);
    const zoom = [
      pushTime - zoomOffset,
      pushTime + zoomOffset,
      Number(Math.max(0, low - padding).toFixed(2)),
      Number((high + padding).toFixed(2)),
    ].join(',');

    return `${
      thBaseUrl +
      getGraphsURL(alert, timeRange, repository, framework).slice(1)
    }&zoom=${zoom}`;
  }

  getSortedAlerts() {
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
    return { regressed, improved };
  }

  get summaryLine() {
    const { regressed, improved } = this.getSortedAlerts();
    return getChangesSummary(
      regressed,
      improved,
      getFrameworkName(this.frameworks, this.alertSummary.framework),
    );
  }

  get markdown() {
    let resultStr = '';
    const { regressed, improved } = this.getSortedAlerts();

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
    const amountPct = formatPercent(alert.amount_pct);
    const graphLink = this.getGraphLink(alert);

    const {
      suite,
      test,
      machine_platform: platform,
      measurement_unit: unit,
    } = alert.series_signature;
    const prevValue = formatValueWithUnit(
      alert.prev_value,
      unit,
      beforeAfterPrecision,
    );
    const newValue = formatValueWithUnit(
      alert.new_value,
      unit,
      beforeAfterPrecision,
    );
    const extraOptions = getOptionsText(alert);

    const updatedAlert = this.browsertimeAlertsExtraData.find(
      (a) => alert.id === a.id,
    );
    const frameworkName = getFrameworkName(
      this.frameworks,
      this.alertSummary.framework,
    );
    const perfdocs = new Perfdocs(frameworkName, suite, platform);
    const url = perfdocs.documentationURL;
    // escape brackets so they don't break the markdown link
    const suiteName = perfdocs.hasDocumentation()
      ? `[${suite.replace(/[[\]\\]/g, '\\$&')}](${url})`
      : suite;
    const suiteTestName =
      test && suite !== test ? `${suiteName} : ${test}` : suiteName;

    const valuePair =
      updatedAlert?.results_link &&
      updatedAlert.prev_results_link
        ? `[${prevValue}](${updatedAlert.prev_results_link})${valueSeparator}[${newValue}](${updatedAlert.results_link})`
        : `${prevValue}${valueSeparator}${newValue}`;

    const cells = [
      // the percentage comes first so the rows read like a ranked list
      `[${getChangeArrow(alert)}${amountPct}%](${graphLink})`,
      suiteTestName,
      valuePair,
      getAbsoluteChange(alert),
      platform,
    ];
    if (this.hasOptions) {
      cells.push(extraOptions);
    }
    if (this.hasProfileUrls) {
      // Add an additional column for the profiler before and after so users can
      // find the profiler links easily. Only add this column if at least one alert
      // has profile urls, with "-" for the alerts without any.
      cells.push(
        updatedAlert?.profile_url && updatedAlert.prev_profile_url
          ? `[Before](${getPerfAnalysisUrl(
              updatedAlert.prev_profile_url,
            )})/[After](${getPerfAnalysisUrl(updatedAlert.profile_url)})`
          : '-',
      );
    }

    return `| ${cells.join(' | ')} |`;
  }

  formatAlertBulk(alerts) {
    return alerts.map((alert) => this.formatAlert(alert)).join('\n');
  }

  // markdown needs the blank line, or it reads the note as a table row
  getHiddenAlertsNote(count, name) {
    const alertLink = `${thBaseUrl}perfherder/alerts?id=${this.alertSummary.id}`;
    return `\n_[... and ${count} more ${name}](${alertLink})_\n`;
  }

  formatTable(name, sortedAlerts, limits) {
    const { biggestRows, smallestRows, hiddenCount } = getTableRows(
      sortedAlerts,
      limits,
    );
    const heading = `\n\n### ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    let resultStr = heading + this.getTableHeader();
    resultStr += this.formatAlertBulk([...biggestRows, ...smallestRows]);
    resultStr += '\n';
    if (hiddenCount) {
      resultStr += this.getHiddenAlertsNote(hiddenCount, name);
    }
    return resultStr;
  }

  getFormattedRegressions(regressed) {
    if (regressed.length === 0) {
      return '';
    }
    // add a newline if we displayed the header
    const resultStr = this.copySummary ? '\n' : '';
    return `${resultStr}${this.formatTable(
      'regressions',
      regressed,
      tableLimits.regression,
    )}`;
  }

  getFormattedImprovements(improved) {
    if (improved.length === 0) {
      return '';
    }
    return this.formatTable('improvements', improved, tableLimits.improvement);
  }

  // every alert, not only the table rows; labels need alertTasks
  getAgentData(pushRevisions = [], repoModel = null, alertTasks = null) {
    const { regressed, improved } = this.getSortedAlerts();
    const alerts = [...regressed, ...improved];
    if (alerts.length === 0) {
      return null;
    }

    const {
      id,
      framework,
      repository,
      revision,
      prev_push_revision: prevRevision,
      push_timestamp: pushTimestamp,
    } = this.alertSummary;
    const frameworkName = getFrameworkName(this.frameworks, framework);
    const commits = [
      ...pushRevisions.filter((commit) => commit.revision === revision),
      ...pushRevisions.filter((commit) => commit.revision !== revision),
    ].map((commit) => getAgentCommit(commit, repoModel));
    // the task behind a value, and whether it ran on the alerting push
    const getTask = (task, metadata, alertRevision) => {
      const known =
        task ||
        (metadata?.task_id && {
          task_id: metadata.task_id,
          retry_id: metadata.retry_id ?? null,
          label: null,
          revision: alertRevision,
        });
      return known
        ? { ...known, is_alert_push: known.revision === alertRevision }
        : null;
    };

    return {
      alert_summary: id,
      alert_summary_url: `${thBaseUrl}perfherder/alerts?id=${id}`,
      framework: frameworkName,
      framework_id: framework,
      repository,
      push_time: pushTimestamp
        ? new Date(pushTimestamp * 1000).toISOString()
        : null,
      revisions: { before: prevRevision || null, after: revision },
      pushlog_url: repoModel ? repoModel.getPushLogHref(revision) : null,
      perfcompare_url: prevRevision
        ? getPerfCompareBaseURL(
            repository,
            prevRevision,
            repository,
            revision,
            framework,
          )
        : null,
      commands: {
        try: `./mach try perf --alert ${id}`,
        local: `./mach perftest ${id}`,
      },
      commits,
      regression_count: regressed.length,
      improvement_count: improved.length,
      alerts: alerts.map((alert) => {
        const {
          id: signatureId,
          suite,
          test,
          machine_platform: platform,
          extra_options: options = [],
          measurement_unit: unit,
          lower_is_better: lowerIsBetter,
        } = alert.series_signature;
        const perfdocs = new Perfdocs(frameworkName, suite, platform);
        const tasks = alertTasks?.get(alert.id);
        const extraData = this.browsertimeAlertsExtraData.find(
          (item) => item.id === alert.id,
        );
        return {
          alert_id: alert.id,
          signature_id: signatureId,
          test: suite,
          subtest: test && test !== suite ? test : null,
          platform,
          options,
          unit: unit || null,
          lower_is_better:
            typeof lowerIsBetter === 'boolean' ? lowerIsBetter : null,
          is_regression: alert.is_regression,
          before: alert.prev_value,
          after: alert.new_value,
          change_pct: alert.amount_pct,
          change_abs: alert.amount_abs,
          tasks: {
            before: getTask(
              tasks?.before,
              alert.prev_taskcluster_metadata,
              prevRevision,
            ),
            after: getTask(tasks?.after, alert.taskcluster_metadata, revision),
          },
          profile_urls: {
            before: extraData?.prev_profile_url || null,
            after: extraData?.profile_url || null,
          },
          docs_url: perfdocs.hasDocumentation()
            ? perfdocs.documentationURL
            : null,
          graph_url: this.getGraphLink(alert),
          data_url: this.getSeriesDataUrl(alert),
        };
      }),
    };
  }

  // fixed dates keep the link useful later on
  getSeriesDataUrl(alert) {
    const { repository, push_timestamp: pushTimestamp } = this.alertSummary;
    const { id: signatureId, framework_id: frameworkId } =
      alert.series_signature;
    const pushTime = pushTimestamp * 1000;
    const toDay = (time) => new Date(time).toISOString().slice(0, 19);
    const params = new URLSearchParams({
      repository,
      signature: signatureId,
      framework: frameworkId,
      startday: toDay(pushTime - seriesDataDays * dayInMs),
      endday: toDay(pushTime + seriesDataDays * dayInMs),
      all_data: true,
      replicates: false,
    });
    return `${thBaseUrl}api/performance/summary/?${params}`;
  }

  // a copied summary can only point to the API
  getAgentDetails(isAttached = false) {
    const { regressed, improved } = this.getSortedAlerts();
    if (regressed.length + improved.length === 0) {
      return '';
    }
    const { id } = this.alertSummary;
    return isAttached
      ? `**For agents and tools:** the alert data is in the attachment \`${getAgentAttachmentName(
          id,
        )}\`.`
      : `**For agents and tools:** the alert data is at ${thBaseUrl}api/performance/alertsummary/${id}/`;
  }
}
