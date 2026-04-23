import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExternalLinkAlt,
  faSort,
  faSortUp,
  faSortDown,
} from '@fortawesome/free-solid-svg-icons';

import {
  getPerfAnalysisUrl,
  getCrashViewerUrl,
  getPernoscoURL,
} from '../helpers/url';
import {
  formatByteSize,
  formatExpires,
  formatSizeTooltip,
  formatExpiresTooltip,
} from '../helpers/display';

// Pattern to match crash dump files: UUID.{dmp,extra,json}
const CRASH_DUMP_PATTERN = /^([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\.(dmp|extra|json)$/i;

const ArtifactLink = ({ artifact, children = null }) => (
  <a
    data-testid="task-artifact"
    title={artifact.value}
    href={artifact.url}
    target="_blank"
    rel="noopener noreferrer"
  >
    {children || artifact.value}
  </a>
);

ArtifactLink.propTypes = {
  artifact: PropTypes.shape({
    url: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  children: PropTypes.node,
};

// Invisible <a> filling the cell, so hover shows the URL and clicks on
// otherwise-inert text (path prefix, size, expires) navigate there.
const CellLink = ({ href, label }) => (
  <a
    className="overlay-link"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    tabIndex={-1}
  >
    <span className="sr-only">{label}</span>
  </a>
);

export default class JobArtifacts extends React.PureComponent {
  state = { sortKey: 'name', sortDir: 'asc' };

  sort = (key) => {
    this.setState((prev) => {
      const toggle = { asc: 'desc', desc: 'asc' };
      const sortDir =
        prev.sortKey === key ? toggle[prev.sortDir] : key === 'size' ? 'desc' : 'asc';
      return { sortKey: key, sortDir };
    });
  };

  sortHeader(key, label, className = '') {
    const { sortKey, sortDir } = this.state;
    const active = sortKey === key;
    const icon = !active ? faSort : sortDir === 'asc' ? faSortUp : faSortDown;
    return (
      <th
        scope="col"
        className={`sortable ${className}`}
        aria-sort={
          active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        onClick={() => this.sort(key)}
      >
        {label}{' '}
        <FontAwesomeIcon icon={icon} className={active ? '' : 'text-muted'} />
      </th>
    );
  }

  shouldShowPernoscoLink(repoName, selectedJob) {
    return (
      (repoName === 'try' || repoName === 'autoland' || repoName === 'enterprise-firefox-pr') &&
      selectedJob &&
      selectedJob.task_id &&
      selectedJob.result === 'testfailed' &&
      // only supports linux 64 builds
      selectedJob.build_platform.match(/linux(?=.*64\b).*$/)
    );
  }

  groupCrashDumps(jobDetails) {
    const crashDumps = new Map(); // Maps crash ID to {dmp, extra, json} artifacts
    const completeCrashIds = new Set(); // Crash IDs with all 3 files

    jobDetails.forEach((artifact) => {
      const match = artifact.value.match(CRASH_DUMP_PATTERN);
      if (match) {
        const crashId = match[1];
        const fileType = match[2];

        if (!crashDumps.has(crashId)) {
          crashDumps.set(crashId, { crashId });
        }
        crashDumps.get(crashId)[fileType] = artifact;
      }
    });

    // Identify complete crash dumps (all 3 files present) and compute
    // aggregated size (sum) and expiry (earliest) across the 3 files.
    crashDumps.forEach((crash, crashId) => {
      if (crash.dmp && crash.extra && crash.json) {
        completeCrashIds.add(crashId);
        const files = [crash.dmp, crash.extra, crash.json];
        crash.contentLength = files.reduce(
          (sum, f) =>
            Number.isFinite(f.contentLength) ? sum + f.contentLength : sum,
          0,
        );
        crash.expires = files
          .map((f) => f.expires)
          .filter(Boolean)
          .sort()[0];
      }
    });

    return { crashDumps, completeCrashIds };
  }

  render() {
    const {
      jobDetails = [],
      jobArtifactsLoading = false,
      repoName = null,
      selectedJob = null,
    } = this.props;

    const { crashDumps, completeCrashIds } = this.groupCrashDumps(jobDetails);

    // Emit one row per artifact, collapsing complete crash dumps into a
    // single aggregated row (anchored on the .json file).
    const rows = jobDetails.flatMap((line) => {
      const match = line.value.match(CRASH_DUMP_PATTERN);
      if (match) {
        const [, crashId, fileType] = match;
        if (completeCrashIds.has(crashId)) {
          if (fileType !== 'json') return [];
          const crash = crashDumps.get(crashId);
          return [
            {
              ...line,
              contentLength: crash.contentLength,
              expires: crash.expires,
              crash,
            },
          ];
        }
      }
      return [line];
    });

    const { sortKey, sortDir } = this.state;
    const mul = sortDir === 'asc' ? 1 : -1;
    const sortedDetails = rows.sort((a, b) => {
      if (sortKey === 'size') {
        const av = Number.isFinite(a.contentLength) ? a.contentLength : -Infinity;
        const bv = Number.isFinite(b.contentLength) ? b.contentLength : -Infinity;
        return (av - bv) * mul;
      }
      if (sortKey === 'expires') {
        const av = a.expires ? new Date(a.expires).getTime() : Infinity;
        const bv = b.expires ? new Date(b.expires).getTime() : Infinity;
        return (av - bv) * mul;
      }
      const name = (x) => `${x.path ? `${x.path}/` : ''}${x.value || ''}`;
      return name(a).localeCompare(name(b)) * mul;
    });

    return (
      <div id="job-artifacts-list" role="region" aria-label="Artifacts">
        {this.shouldShowPernoscoLink(repoName, selectedJob) && (
          <div className="py-2">
            <a
              className="text-darker-secondary font-weight-bold font-size-14"
              target="_blank"
              rel="noopener noreferrer"
              href={getPernoscoURL(selectedJob.task_id)}
            >
              <span>
                Reproduce this failure in the Pernosco app{' '}
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className="icon-superscript"
                />
              </span>
            </a>
          </div>
        )}
        {jobArtifactsLoading && <span>Loading job artifacts…</span>}
        {!jobArtifactsLoading && sortedDetails.length > 0 && (
          <table className="table table-super-condensed table-hover artifacts-table">
            <thead>
              <tr>
                {this.sortHeader('name', 'Name')}
                {this.sortHeader('expires', 'Expires in', 'text-nowrap text-end')}
                {this.sortHeader('size', 'Size', 'text-end')}
              </tr>
            </thead>
            <tbody>
              {sortedDetails.map((line) => {
                if (line.crash) {
                  const { crash } = line;
                  const viewerUrl = getCrashViewerUrl(crash.json.url);
                  return (
                    <tr key={line.url}>
                      <td>
                        <CellLink href={viewerUrl} label="Open in crash viewer" />
                        <ArtifactLink artifact={crash.dmp} />
                        {', '}
                        <ArtifactLink artifact={crash.extra}>
                          .extra
                        </ArtifactLink>
                        {', '}
                        <ArtifactLink artifact={crash.json}>.json</ArtifactLink>{' '}
                        -{' '}
                        <a
                          title="Open in crash viewer"
                          href={viewerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          open in crash viewer
                        </a>
                      </td>
                      <td
                        className="text-end text-nowrap text-muted"
                        title={formatExpiresTooltip(line.expires)}
                      >
                        <CellLink href={viewerUrl} label="Open in crash viewer" />
                        <span>{formatExpires(line.expires)}</span>
                      </td>
                      <td
                        className="text-end text-nowrap text-muted"
                        title={formatSizeTooltip(line.contentLength)}
                      >
                        <CellLink href={viewerUrl} label="Open in crash viewer" />
                        <span>{formatByteSize(line.contentLength)}</span>
                      </td>
                    </tr>
                  );
                }

                const isProfileArtifact =
                  !!line.url &&
                  line.value.startsWith('profile_') &&
                  (line.value.endsWith('.zip') || line.value.endsWith('.json'));
                const primaryUrl = isProfileArtifact
                  ? getPerfAnalysisUrl(line.url, selectedJob)
                  : line.url;
                const primaryTitle = isProfileArtifact
                  ? `Open ${line.value} in the Firefox Profiler`
                  : line.value;

                return (
                  <tr key={line.url}>
                    <td>
                      {primaryUrl && <CellLink href={primaryUrl} label={primaryTitle} />}
                      {line.path && (
                        <span className="text-muted">{line.path}/</span>
                      )}
                      {!!line.url && <ArtifactLink artifact={line} />}
                      {isProfileArtifact && (
                        <>
                          {' '}
                          -{' '}
                          <a
                            title={line.value}
                            href={primaryUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            open in Firefox Profiler
                          </a>
                        </>
                      )}
                    </td>
                    <td
                      className="text-end text-nowrap text-muted"
                      title={formatExpiresTooltip(line.expires)}
                    >
                      {primaryUrl && <CellLink href={primaryUrl} label={primaryTitle} />}
                      <span>{formatExpires(line.expires)}</span>
                    </td>
                    <td
                      className="text-end text-nowrap text-muted"
                      title={formatSizeTooltip(line.contentLength)}
                    >
                      {primaryUrl && <CellLink href={primaryUrl} label={primaryTitle} />}
                      <span>{formatByteSize(line.contentLength)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}

JobArtifacts.propTypes = {
  jobDetails: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      title: PropTypes.string,
      path: PropTypes.string,
      contentLength: PropTypes.number,
      expires: PropTypes.string,
    }),
  ),
  jobArtifactsLoading: PropTypes.bool,
  repoName: PropTypes.string,
  selectedJob: PropTypes.shape({}),
};
