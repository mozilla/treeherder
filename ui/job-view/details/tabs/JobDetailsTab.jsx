import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../../../js/treeherder';
import { getPerfAnalysisUrl, getWptUrl } from '../../../helpers/url';

export default class JobDetailsTab extends React.PureComponent {
  render() {
    const { jobDetails, buildernameIndex } = this.props;
    const sortedDetails = jobDetails ? jobDetails.slice() : [];

    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div className="job-tabs-content">
        <ul className="list-unstyled">
          {sortedDetails.map((line, idx) => (
            <li
              className="small"
              key={idx} // eslint-disable-line react/no-array-index-key
            >
              <label>{line.title ? line.title : 'Untitled data'}:</label>&nbsp;
              {/* URL provided */}
              {!!line.url && <a
                title={line.title ? line.title : line.value}
                href={line.url}
                target="_blank"
                rel="noopener"
              >{line.value}</a>}
              {line.url && line.value.endsWith('raw.log') &&
                <span> - <a
                  title={line.value}
                  href={getWptUrl(line.url, jobDetails[buildernameIndex] ? jobDetails[buildernameIndex].value : undefined)}
                >open in test results viewer</a>
                </span>}
              {line.url && line.value.startsWith('profile_') && line.value.endsWith('.zip') &&
                <span> - <a
                  title={line.value}
                  href={getPerfAnalysisUrl(line.url)}
                >open in perf-html.io</a>
                </span>}
              {/*
                no URL (just informational)
                If this is showing HTML from a TinderboxPrint line it should
                have been parsed in our log parser to a url instead of getting here.
                If it wasn't, it probably had a <br/> tag and didn't have
                a 'title' value in the '<a>' element.
              */}
              {!line.url && <span>{line.value}</span>}
            </li>))}
        </ul>
      </div>
    );
  }
}

JobDetailsTab.propTypes = {
  jobDetails: PropTypes.array,
  buildernameIndex: PropTypes.number,
};

JobDetailsTab.defaultProps = {
  jobDetails: [],
  buildernameIndex: null,
};

treeherder.component('jobDetailsTab', react2angular(JobDetailsTab));
