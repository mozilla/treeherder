import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faTable } from '@fortawesome/free-solid-svg-icons';

import { getCompareChooserUrl, getPerfAnalysisUrl } from '../../../helpers/url';

export default class PerformanceTab extends React.PureComponent {
  maybeGetFirefoxProfilerLink() {
    // Look for a profiler artifact.
    const jobDetail = this.props.jobDetails.find(
      ({ url, value }) =>
        url &&
        value.startsWith('profile_') &&
        (value.endsWith('.zip') || value.endsWith('.json')),
    );

    if (jobDetail) {
      return (
        <a
          title={jobDetail.value}
          href={getPerfAnalysisUrl(jobDetail.url)}
          className="btn btn-primary btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
          Open in Firefox Profiler
        </a>
      );
    }

    return null;
  }

  render() {
    const { repoName, revision, perfJobDetail } = this.props;
    const profilerLink = this.maybeGetFirefoxProfilerLink();
    const sortedDetails = perfJobDetail ? perfJobDetail.slice() : [];

    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div
        className="performance-panel h-100 overflow-auto"
        role="region"
        aria-label="Performance"
      >
        <div className="performance-panel-actions">
          {
            // If there is a profiler link, show this first. This is most likely
            // the primary action of the user here.
            profilerLink
          }
          <a
            href={getCompareChooserUrl({
              newProject: repoName,
              newRevision: revision,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <FontAwesomeIcon icon={faTable} className="mr-2" />
            Compare against another revision
          </a>
        </div>
        {!!sortedDetails.length && (
          <ul>
            <li>
              Perfherder:
              {sortedDetails.map((detail, idx) => (
                <ul
                  key={idx} // eslint-disable-line react/no-array-index-key
                >
                  <li>
                    {detail.title}:<a href={detail.url}> {detail.value}</a>
                  </li>
                </ul>
              ))}
            </li>
          </ul>
        )}
      </div>
    );
  }
}

PerformanceTab.propTypes = {
  repoName: PropTypes.string.isRequired,
  jobDetails: PropTypes.arrayOf(PropTypes.object),
  perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  revision: PropTypes.string,
};

PerformanceTab.defaultProps = {
  jobDetails: [],
  perfJobDetail: [],
  revision: '',
};
