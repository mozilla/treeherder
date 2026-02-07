import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import {
  getPerfAnalysisUrl,
  getCrashViewerUrl,
  getPernoscoURL,
} from '../helpers/url';

const UNTITLED = 'Untitled data';
// Pattern to match crash dump files: UUID.{dmp,extra,json}
const CRASH_DUMP_PATTERN = /^([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\.(dmp|extra|json)$/i;

const ArtifactLink = ({ artifact, children = null }) => (
  <a
    data-testid="task-artifact"
    title={artifact.title || artifact.value}
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
    title: PropTypes.string,
  }).isRequired,
  children: PropTypes.node,
};

export default class JobArtifacts extends React.PureComponent {
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

    // Identify complete crash dumps (all 3 files present)
    crashDumps.forEach((crash, crashId) => {
      if (crash.dmp && crash.extra && crash.json) {
        completeCrashIds.add(crashId);
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

    const sortedDetails = jobDetails.slice();
    sortedDetails.sort((a, b) => {
      const compareA = a.title || UNTITLED;
      const compareB = b.title || UNTITLED;
      return compareA.localeCompare(compareB);
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
        {!jobArtifactsLoading && (
          <ul className="list-unstyled">
            {sortedDetails.length > 0 &&
              sortedDetails.map((line) => {
                const match = line.value.match(CRASH_DUMP_PATTERN);

                // Handle complete crash dumps
                if (match) {
                  const [, crashId, fileType] = match;

                  if (completeCrashIds.has(crashId)) {
                    // Only render once per complete crash (on .json file)
                    if (fileType !== 'json') return null;

                    const crash = crashDumps.get(crashId);
                    return (
                      <li className="link-style" key={line.url}>
                        <ArtifactLink artifact={crash.dmp} />
                        {', '}
                        <ArtifactLink artifact={crash.extra}>
                          .extra
                        </ArtifactLink>
                        {', '}
                        <ArtifactLink artifact={crash.json}>.json</ArtifactLink>
                        <span>
                          {' '}
                          -{' '}
                          <a
                            title="Open in crash viewer"
                            href={getCrashViewerUrl(crash.json.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            open in crash viewer
                          </a>
                        </span>
                      </li>
                    );
                  }
                }

                // Render all other artifacts normally
                return (
                  <li className="link-style" key={line.url}>
                    {!!line.url && <ArtifactLink artifact={line} />}
                    {line.url &&
                      line.value.startsWith('profile_') &&
                      (line.value.endsWith('.zip') ||
                        line.value.endsWith('.json')) && (
                        <span>
                          {' '}
                          -{' '}
                          <a
                            title={line.value}
                            href={getPerfAnalysisUrl(line.url, selectedJob)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            open in Firefox Profiler
                          </a>
                        </span>
                      )}
                  </li>
                );
              })}
          </ul>
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
    }),
  ),
  jobArtifactsLoading: PropTypes.bool,
  repoName: PropTypes.string,
  selectedJob: PropTypes.shape({}),
};
