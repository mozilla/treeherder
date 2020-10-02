import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable } from '@fortawesome/free-solid-svg-icons';

import { getCompareChooserUrl } from '../../../helpers/url';

export default class PerformanceTab extends React.PureComponent {
  render() {
    const { repoName, revision, perfJobDetail } = this.props;
    const sortedDetails = perfJobDetail ? perfJobDetail.slice() : [];

    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div
        className="performance-panel h-100 overflow-auto"
        role="region"
        aria-label="Performance"
      >
        <div className="performance-panel-actions">
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
  perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  revision: PropTypes.string,
};

PerformanceTab.defaultProps = {
  perfJobDetail: [],
  revision: '',
};
