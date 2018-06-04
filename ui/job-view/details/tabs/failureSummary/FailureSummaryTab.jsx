import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../../../../js/treeherder';
import ErrorsList from './ErrorsList';
import SuggestionsListItem from './SuggestionsListItem';
import ListItem from './ListItem';

class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.$timeout = $injector.get('$timeout');
    this.thPinboard = $injector.get('thPinboard');
  }

  render() {
    const {
      fileBug, jobLogUrls, logParseStatus, suggestions, errors,
      bugSuggestionsLoading, selectedJob
    } = this.props;
    const logs = jobLogUrls;
    const jobLogsAllParsed = logs.every(jlu => (jlu.parse_status !== 'pending'));

    return (
      <ul className="list-unstyled failure-summary-list" ref={this.fsMount}>
        {suggestions.map((suggestion, index) =>
          (<SuggestionsListItem
            key={index}  // eslint-disable-line react/no-array-index-key
            index={index}
            suggestion={suggestion}
            fileBug={fileBug}
            pinboardService={this.thPinboard}
            selectedJob={selectedJob}
            $timeout={this.$timeout}
          />))}

        {!!errors.length &&
          <ErrorsList errors={errors} />}

        {!bugSuggestionsLoading && jobLogsAllParsed &&
          !logs.length && !suggestions.length && !errors.length &&
          <ListItem text="Failure summary is empty" />}

        {!bugSuggestionsLoading && jobLogsAllParsed && !!logs.length &&
          logParseStatus === 'success' &&
          <li>
            <p className="failure-summary-line-empty mb-0">Log parsing complete. Generating bug suggestions.<br />
              <span>The content of this panel will refresh in 5 seconds.</span></p>
          </li>}

        {!bugSuggestionsLoading && !jobLogsAllParsed &&
         logs.map(jobLog =>
           (<li key={jobLog.id}>
             <p className="failure-summary-line-empty mb-0">Log parsing in progress.<br />
               <a
                 title="Open the raw log in a new window"
                 target="_blank"
                 rel="noopener"
                 href={jobLog.url}
               >The raw log</a> is available. This panel will automatically recheck every 5 seconds.</p>
           </li>))}

        {!bugSuggestionsLoading && logParseStatus === 'failed' &&
          <ListItem text="Log parsing failed.  Unable to generate failure summary." />}

        {!bugSuggestionsLoading && !logs.length &&
          <ListItem text="No logs available for this job." />}

        {bugSuggestionsLoading &&
          <div className="overlay">
            <div>
              <span className="fa fa-spinner fa-pulse th-spinner-lg" />
            </div>
          </div>}
      </ul>
    );
  }
}

FailureSummaryTab.propTypes = {
  $injector: PropTypes.object.isRequired,
  fileBug: PropTypes.func.isRequired,
  suggestions: PropTypes.array,
  selectedJob: PropTypes.object,
  errors: PropTypes.array,
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.array,
  logParseStatus: PropTypes.string,
};

FailureSummaryTab.defaultProps = {
  suggestions: [],
  selectedJob: null,
  errors: [],
  bugSuggestionsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
};

treeherder.component('failureSummaryTab', react2angular(
  FailureSummaryTab,
  ['fileBug', 'suggestions', 'selectedJob', 'errors', 'bugSuggestionsLoading', 'jobLogUrls', 'logParseStatus'],
  ['$injector']));
