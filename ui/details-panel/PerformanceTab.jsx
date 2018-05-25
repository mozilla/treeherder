import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../js/treeherder';
import { getCompareChooserUrl } from '../helpers/url';

class PerformanceTab extends React.PureComponent {

  render() {
    const { repoName, revision, perfJobDetail } = this.props;
    const sortedDetails = perfJobDetail ? perfJobDetail.slice() : [];

    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div className="performance-panel">
        {!!sortedDetails.length && <ul>
          <li>Perfherder:
            {sortedDetails.map((detail, idx) => (
              <ul
                key={idx} // eslint-disable-line react/no-array-index-key
              >
                <li>{detail.title}:
                  <a href={detail.url}> {detail.value}</a>
                </li>
              </ul>
            ))}
          </li>
        </ul>}
        <ul>
          <li>
            <a
              href={getCompareChooserUrl({ newProject: repoName, newRevision: revision })}
              target="_blank"
              rel="noopener"
            >Compare result against another revision</a>
          </li>
        </ul>
      </div>
    );
  }
}

PerformanceTab.propTypes = {
  repoName: PropTypes.string.isRequired,
  perfJobDetail: PropTypes.array,
  revision: PropTypes.string,
};

PerformanceTab.defaultProps = {
  perfJobDetail: [],
  revision: '',
};

treeherder.component('performanceTab', react2angular(
  PerformanceTab,
  ['repoName', 'revision', 'perfJobDetail']));
