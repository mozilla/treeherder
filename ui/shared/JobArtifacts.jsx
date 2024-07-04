import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import { getPerfAnalysisUrl, getPernoscoURL } from '../helpers/url';

const UNTITLED = 'Untitled data';

export default class JobArtifacts extends React.PureComponent {
  shouldShowPernoscoLink(repoName, selectedJob) {
    return (
      (repoName === 'try' || repoName === 'autoland') &&
      selectedJob &&
      selectedJob.task_id &&
      selectedJob.result === 'testfailed' &&
      // only supports linux 64 builds
      selectedJob.build_platform.match(/linux(?=.*64\b).*$/)
    );
  }

  render() {
    const { jobDetails, jobArtifactsLoading, repoName, selectedJob } =
      this.props;
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
              sortedDetails.map((line) => (
                <li className="link-style" key={line.value}>
                  {!!line.url && (
                    <a
                      data-testid="task-artifact"
                      title={line.title ? line.title : line.value}
                      href={line.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {line.value}
                    </a>
                  )}
                  {line.url &&
                    line.value.startsWith('profile_') &&
                    (line.value.endsWith('.zip') ||
                      line.value.endsWith('.json')) && (
                      <span>
                        {' '}
                        -{' '}
                        <a
                          title={line.value}
                          href={getPerfAnalysisUrl(line.url)}
                        >
                          open in Firefox Profiler
                        </a>
                      </span>
                    )}
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }
}

JobArtifacts.propTypes = {
  jobDetails: PropTypes.arrayOf(PropTypes.object),
  jobArtifactsLoading: PropTypes.bool,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.shape({}).isRequired,
};

JobArtifacts.defaultProps = {
  jobDetails: [],
  jobArtifactsLoading: false,
};
