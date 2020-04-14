import React from 'react';
import PropTypes from 'prop-types';

import { getPerfAnalysisUrl } from '../helpers/url';

const UNTITLED = 'Untitled data';

export default class JobDetails extends React.PureComponent {
  render() {
    const { jobDetails } = this.props;
    const sortedDetails = jobDetails.slice();

    sortedDetails.sort((a, b) => {
      const compareA = a.title || UNTITLED;
      const compareB = b.title || UNTITLED;
      return compareA.localeCompare(compareB);
    });

    return (
      <div id="job-details-list" role="region" aria-label="Job Details">
        <ul className="list-unstyled">
          {sortedDetails.map((line, idx) => (
            <li
              className="small"
              key={idx} // eslint-disable-line react/no-array-index-key
            >
              <strong>{line.title ? line.title : UNTITLED}:</strong>&nbsp;
              {/* URL provided */}
              {!!line.url && (
                <a
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
                    <a title={line.value} href={getPerfAnalysisUrl(line.url)}>
                      open in Firefox Profiler
                    </a>
                  </span>
                )}
              {/*
                no URL (just informational)
                If this is showing HTML from a TinderboxPrint line it should
                have been parsed in our log parser to a url instead of getting here.
                If it wasn't, it probably had a <br/> tag and didn't have
                a 'title' value in the '<a>' element.
              */}
              {!line.url && <span>{line.value}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

JobDetails.propTypes = {
  jobDetails: PropTypes.arrayOf(PropTypes.object),
};

JobDetails.defaultProps = {
  jobDetails: [],
};
