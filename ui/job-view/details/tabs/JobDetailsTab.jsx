import React from 'react';
import PropTypes from 'prop-types';

import { getPerfAnalysisUrl, getWptUrl } from '../../../helpers/url';

export default class JobDetailsTab extends React.PureComponent {
  render() {
    const { jobDetails } = this.props;
    const sortedDetails = jobDetails ? jobDetails.slice() : [];
    const builderNameItem = jobDetails.findIndex(detail => detail.title === "Buildername");
    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div id="job-details-list">
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
                  href={getWptUrl(line.url, builderNameItem ? builderNameItem.value : undefined)}
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
};

JobDetailsTab.defaultProps = {
  jobDetails: [],
};
