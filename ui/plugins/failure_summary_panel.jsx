import PropTypes from 'prop-types';

import treeherder from '../js/treeherder';
import { getBugUrl } from '../helpers/urlHelper';

class SuggestionsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionShowMore: false
    };

    this.fileBugEvent = this.fileBugEvent.bind(this);
  }

  fileBugEvent(event) {
    event.preventDefault();
    this.props.fileBug(this.props.index);
  }

  clickShowMore(event) {
    event.preventDefault();
    this.setState({ suggestionShowMore: !this.state.suggestionShowMore });
  }

  render() {
    //If this method is bound in the constructor it gives me a warning about only setting state in a mounted component
    // but if we move to allowing the arrow function in classes at some point, this problem should be solved.
    this.clickShowMore = this.clickShowMore.bind(this);
    return (
      <li>
        <div className="job-tabs-content">
          {(this.props.filerInAddress || this.props.user.is_staff) &&
            <a
              className="btn btn-xs btn-light-bordered"
              onClick={this.fileBugEvent}
              title="file a bug for this failure"
            >
              <i className="fa fa-bug" />
            </a>}
          <span>{this.props.suggestion.search}</span>
        </div>

        {/* <!--Open recent bugs--> */}
        {this.props.suggestion.valid_open_recent &&
        <ul className="list-unstyled failure-summary-bugs">
          {this.props.suggestion.bugs.open_recent.map((bug, index) =>
            (<BugListItem
              key={index} bug={bug} selectedJob={this.props.selectedJob}
              pinboardService={this.props.pinboardService}
              escapeHTMLFilter={this.props.escapeHTMLFilter} suggestion={this.props.suggestion}
              highlightCommonTermsFilter={this.props.highlightCommonTermsFilter}
              $timeout={this.props.$timeout}
            />))}

        </ul>}

        {/* <!--All other bugs--> */}
        {this.props.suggestion.valid_all_others && this.props.suggestion.valid_open_recent &&
        <a
          target="_blank"
          rel="noopener"
          href=""
          onClick={this.clickShowMore}
          className="show-hide-more"
        >Show / Hide more</a>}

        {this.props.suggestion.valid_all_others && (this.state.suggestionShowMore
          || !this.props.suggestion.valid_open_recent) &&
          <ul className="list-unstyled failure-summary-bugs">
            {this.props.suggestion.bugs.all_others.map((bug, index) =>
              (<BugListItem
                key={index} bug={bug} selectedJob={this.props.selectedJob}
                pinboardService={this.props.pinboardService}
                escapeHTMLFilter={this.props.escapeHTMLFilter} suggestion={this.props.suggestion}
                highlightCommonTermsFilter={this.props.highlightCommonTermsFilter}
                bugClassName={bug.resolution !== "" ? "deleted" : ""}
                title={bug.resolution !== "" ? bug.resolution : ""}
              />))}
          </ul>}

        {(this.props.suggestion.bugs.too_many_open_recent || (this.props.suggestion.bugs.too_many_all_others
            && !this.props.suggestion.valid_open_recent)) &&
            <mark>Exceeded max {this.props.bugLimit} bug suggestions, most of which are likely false positives.</mark>}
      </li>
    );
  }
}


function ListItem(props) {
  return (
    <li>
      <p className="failure-summary-line-empty mb-0">{props.text}</p>
    </li>
  );
}


function BugListItem(props) {
  const pinboardServiceEvent = () => {
    const { bug, selectedJob, pinboardService, $timeout } = props;
    $timeout(() => (pinboardService.addBug(bug, selectedJob)));
  };

  const bugUrl = getBugUrl(props.bug.id);
  const bugSummaryText = props.escapeHTMLFilter(props.bug.summary);
  const bugSummaryHTML = { __html: props.highlightCommonTermsFilter(bugSummaryText, props.suggestion.search) };

  return (
    <li>
      <button
        className="btn btn-xs btn-light-bordered"
        onClick={pinboardServiceEvent}
        title="add to list of bugs to associate with all pinned jobs"
      >
        <i className="fa fa-thumb-tack" />
      </button>
      <a
        className={`${props.bugClassName} ml-1`}
        href={bugUrl}
        target="_blank"
        rel="noopener"
        title={props.title}
      >{props.bug.id}
        <span className={`${props.bugClassName} ml-1`} dangerouslySetInnerHTML={bugSummaryHTML} />
      </a>
    </li>
  );
}


function ErrorsList(props) {
  const errorListItem = props.errors.map((error, index) =>
    (<li key={index}>{error.name} : {error.result}.
      <a
        title="Open in Log Viewer"
        target="_blank"
        rel="noopener"
        href={error.lvURL}
      ><span className="ml-1">View log</span></a>
    </li>));

  return (
    <li>
      No Bug Suggestions Available.<br />
      <span className="font-weight-bold">Unsuccessful Execution Steps</span>
      <ul>{errorListItem}</ul>
    </li>
  );
}


function FailureSummaryPanel(props) {
  const escapeHTMLFilter = props.$injector.get('$filter')('escapeHTML');
  const highlightCommonTermsFilter = props.$injector.get('$filter')('highlightCommonTerms');
  const $timeout = props.$injector.get('$timeout');

  return (
    <ul className="list-unstyled failure-summary-list">
      {props.suggestions && props.suggestions.map((suggestion, index) =>
        (<SuggestionsListItem
          key={index} index={index} suggestion={suggestion} user={props.user}
          filerInAddress={props.filerInAddress} fileBug={props.fileBug}
          highlightCommonTermsFilter={highlightCommonTermsFilter}
          escapeHTMLFilter={escapeHTMLFilter}
          bugLimit={props.bugLimit} pinboardService={props.pinboardService}
          selectedJob={props.selectedJob}
          $timeout={$timeout}
        />))}

      {props.errors && props.errors.length > 0 &&
        <ErrorsList errors={props.errors} />}

      {!props.tabs.failureSummary.is_loading && props.jobLogsAllParsed && props.bugSuggestionsLoaded &&
        props.jobLogUrls.length === 0 && props.suggestions.length === 0 && props.errors.length === 0 &&
        <ListItem text="Failure summary is empty" />}

      {!props.tabs.failureSummary.is_loading && props.jobLogsAllParsed && !props.bugSuggestionsLoaded
        && props.jobLogUrls.length && props.logParseStatus === 'success' &&
        <li>
          <p className="failure-summary-line-empty mb-0">Log parsing complete. Generating bug suggestions.<br />
            <span>The content of this panel will refresh in 5 seconds.</span></p>
        </li>}

      {props.jobLogUrls && !props.tabs.failureSummary.is_loading && !props.jobLogsAllParsed &&
       props.jobLogUrls.map((job, index) =>
         (<li key={index}>
           <p className="failure-summary-line-empty mb-0">Log parsing in progress.<br />
             <a
               title="Open the raw log in a new window"
               target="_blank"
               rel="noopener"
               href={job.url}
             >The raw log</a>
             <span>is available. This panel will automatically recheck every 5 seconds.</span></p>
         </li>))}

      {!props.tabs.failureSummary.is_loading && props.logParseStatus === 'failed' &&
        <ListItem text="Log parsing failed.  Unable to generate failure summary." />}

      {!props.tabs.failureSummary.is_loading && props.jobLogUrls && props.jobLogUrls.length === 0 &&
        <ListItem text="No logs available for this job." />}

      {props.tabs.failureSummary.is_loading &&
        <div className="overlay">
          <div>
            <span className="fa fa-spinner fa-pulse th-spinner-lg" />
          </div>
        </div>}
    </ul>
  );
}

FailureSummaryPanel.propTypes = {
  tabs: PropTypes.object,
  suggestions: PropTypes.array,
  filerInAddress: PropTypes.bool,
  fileBug: PropTypes.func,
  user: PropTypes.object,
  pinboardService: PropTypes.object,
  selectedJob: PropTypes.object,
  $injector: PropTypes.object,
  bugLimit: PropTypes.number,
  errors: PropTypes.array,
  bugSuggestionsLoaded: PropTypes.bool,
  jobLogsAllParsed: PropTypes.bool,
  jobLogUrls: PropTypes.array,
  logParseStatus: PropTypes.string
};

treeherder.directive('failureSummaryPanel', ['reactDirective', '$injector', (reactDirective, $injector) =>
reactDirective(FailureSummaryPanel, undefined, {}, { $injector })]);
