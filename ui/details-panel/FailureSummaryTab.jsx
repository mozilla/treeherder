import PropTypes from 'prop-types';

import treeherder from '../js/treeherder';
import { getBugUrl } from '../helpers/urlHelper';

class SuggestionsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionShowMore: false
    };

    this.clickShowMore = this.clickShowMore.bind(this);
  }

  clickShowMore() {
    this.setState({ suggestionShowMore: !this.state.suggestionShowMore });
  }

  render() {
    const {
      filerInAddress, user, suggestion, selectedJob, escapeHTMLFilter,
      highlightCommonTermsFilter, $timeout, pinboardService, bugLimit,
      fileBug, index
    } = this.props;

    return (
      <li>
        <div className="job-tabs-content">
          {(filerInAddress || user.is_staff) &&
            <span
              className="btn btn-xs btn-light-bordered link-style"
              onClick={() => fileBug(index)}
              title="file a bug for this failure"
            >
              <i className="fa fa-bug" />
            </span>}
          <span>{suggestion.search}</span>
        </div>

        {/* <!--Open recent bugs--> */}
        {suggestion.valid_open_recent &&
        <ul className="list-unstyled failure-summary-bugs">
          {suggestion.bugs.open_recent.map(bug =>
            (<BugListItem
              key={bug.id}
              bug={bug}
              selectedJob={selectedJob}
              pinboardService={pinboardService}
              escapeHTMLFilter={escapeHTMLFilter}
              suggestion={suggestion}
              highlightCommonTermsFilter={highlightCommonTermsFilter}
              $timeout={$timeout}
            />))}

        </ul>}

        {/* <!--All other bugs--> */}
        {suggestion.valid_all_others && suggestion.valid_open_recent &&
        <span
          rel="noopener"
          onClick={this.clickShowMore}
          className="show-hide-more"
        >Show / Hide more</span>}

        {suggestion.valid_all_others && (this.state.suggestionShowMore
          || !suggestion.valid_open_recent) &&
          <ul className="list-unstyled failure-summary-bugs">
            {suggestion.bugs.all_others.map(bug =>
              (<BugListItem
                key={bug.id}
                bug={bug}
                selectedJob={selectedJob}
                pinboardService={pinboardService}
                escapeHTMLFilter={escapeHTMLFilter}
                suggestion={suggestion}
                highlightCommonTermsFilter={highlightCommonTermsFilter}
                $timeout={$timeout}
                bugClassName={bug.resolution !== "" ? "deleted" : ""}
                title={bug.resolution !== "" ? bug.resolution : ""}
              />))}
          </ul>}

        {(suggestion.bugs.too_many_open_recent || (suggestion.bugs.too_many_all_others
            && !suggestion.valid_open_recent)) &&
            <mark>Exceeded max {bugLimit} bug suggestions, most of which are likely false positives.</mark>}
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
  const {
    bug, escapeHTMLFilter, highlightCommonTermsFilter, suggestion,
    bugClassName, title, $timeout, pinboardService, selectedJob,
  } = props;
  const bugUrl = getBugUrl(bug.id);
  const bugSummaryText = escapeHTMLFilter(bug.summary);
  const bugSummaryHTML = { __html: highlightCommonTermsFilter(bugSummaryText, suggestion.search) };

  return (
    <li>
      <button
        className="btn btn-xs btn-light-bordered"
        onClick={() => $timeout(() => pinboardService.addBug(bug, selectedJob))}
        title="add to list of bugs to associate with all pinned jobs"
      >
        <i className="fa fa-thumb-tack" />
      </button>
      <a
        className={`${bugClassName} ml-1`}
        href={bugUrl}
        target="_blank"
        rel="noopener"
        title={title}
      >{bug.id}
        <span className={`${bugClassName} ml-1`} dangerouslySetInnerHTML={bugSummaryHTML} />
      </a>
    </li>
  );
}


function ErrorsList(props) {
  const errorListItem = props.errors.map((error, key) => (
    <li
      key={key} // eslint-disable-line react/no-array-index-key
    >{error.name} : {error.result}.
      <a
        title="Open in Log Viewer"
        target="_blank"
        rel="noopener"
        href={error.lvURL}
      ><span className="ml-1">View log</span></a>
    </li>
  ));

  return (
    <li>
      No Bug Suggestions Available.<br />
      <span className="font-weight-bold">Unsuccessful Execution Steps</span>
      <ul>{errorListItem}</ul>
    </li>
  );
}


function FailureSummaryTab(props) {
  const {
    $injector, suggestions, user, filerInAddress, fileBug, bugLimit, pinboardService, selectedJob,
    errors, tabs, jobLogsAllParsed, bugSuggestionsLoaded, jobLogUrls, logParseStatus,
  } = props;
  const escapeHTMLFilter = $injector.get('$filter')('escapeHTML');
  const highlightCommonTermsFilter = $injector.get('$filter')('highlightCommonTerms');
  const $timeout = $injector.get('$timeout');

  return (
    <ul className="list-unstyled failure-summary-list">
      {suggestions && suggestions.map((suggestion, index) =>
        (<SuggestionsListItem
          key={index}  // eslint-disable-line react/no-array-index-key
          index={index}
          suggestion={suggestion}
          user={user}
          filerInAddress={filerInAddress}
          fileBug={fileBug}
          highlightCommonTermsFilter={highlightCommonTermsFilter}
          escapeHTMLFilter={escapeHTMLFilter}
          bugLimit={bugLimit}
          pinboardService={pinboardService}
          selectedJob={selectedJob}
          $timeout={$timeout}
        />))}

      {errors && errors.length > 0 &&
        <ErrorsList errors={errors} />}

      {!tabs.failureSummary.is_loading && jobLogsAllParsed && bugSuggestionsLoaded &&
        jobLogUrls.length === 0 && suggestions.length === 0 && errors.length === 0 &&
        <ListItem text="Failure summary is empty" />}

      {!tabs.failureSummary.is_loading && jobLogsAllParsed && !bugSuggestionsLoaded
        && jobLogUrls.length && logParseStatus === 'success' &&
        <li>
          <p className="failure-summary-line-empty mb-0">Log parsing complete. Generating bug suggestions.<br />
            <span>The content of this panel will refresh in 5 seconds.</span></p>
        </li>}

      {jobLogUrls && !tabs.failureSummary.is_loading && !jobLogsAllParsed &&
       jobLogUrls.map(jobLog =>
         (<li key={jobLog.id}>
           <p className="failure-summary-line-empty mb-0">Log parsing in progress.<br />
             <a
               title="Open the raw log in a new window"
               target="_blank"
               rel="noopener"
               href={jobLog.url}
             >The raw log</a> is available. This panel will automatically recheck every 5 seconds.</p>
         </li>))}

      {!tabs.failureSummary.is_loading && logParseStatus === 'failed' &&
        <ListItem text="Log parsing failed.  Unable to generate failure summary." />}

      {!tabs.failureSummary.is_loading && jobLogUrls && jobLogUrls.length === 0 &&
        <ListItem text="No logs available for this job." />}

      {tabs.failureSummary.is_loading &&
        <div className="overlay">
          <div>
            <span className="fa fa-spinner fa-pulse th-spinner-lg" />
          </div>
        </div>}
    </ul>
  );
}

FailureSummaryTab.propTypes = {
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

treeherder.directive('failureSummaryTab', ['reactDirective', '$injector', (reactDirective, $injector) =>
reactDirective(FailureSummaryTab, undefined, {}, { $injector })]);
