import PropTypes from 'prop-types';
import createHistory from 'history/createBrowserHistory';

import treeherder from '../js/treeherder';
import { getBugUrl } from '../helpers/urlHelper';
import { getAllUrlParams } from '../helpers/locationHelper';
import { escapeHTML, highlightCommonTerms } from "../helpers/displayHelper";

const BUG_LIMIT = 20;

class SuggestionsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionShowMore: false,
      filerInAddress: getAllUrlParams().has('bugfiler'),
    };

    this.updateFilerInAddress = this.updateFilerInAddress.bind(this);
    this.clickShowMore = this.clickShowMore.bind(this);
  }

  componentWillMount() {
    this.unlistenHistory = this.props.history.listen(this.updateFilerInAddress);
  }

  componentWillUnmount() {
    this.unlistenHistory();
  }

  updateFilerInAddress() {
    this.setState({ filerInAddress: getAllUrlParams().has('bugfiler') });
  }

  clickShowMore() {
    this.setState({ suggestionShowMore: !this.state.suggestionShowMore });
  }

  render() {
    const {
      user, suggestion, selectedJob, $timeout, pinboardService, fileBug, index
    } = this.props;
    const { filerInAddress, suggestionShowMore } = this.state;

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
              suggestion={suggestion}
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

        {suggestion.valid_all_others && (suggestionShowMore
          || !suggestion.valid_open_recent) &&
          <ul className="list-unstyled failure-summary-bugs">
            {suggestion.bugs.all_others.map(bug =>
              (<BugListItem
                key={bug.id}
                bug={bug}
                selectedJob={selectedJob}
                pinboardService={pinboardService}
                suggestion={suggestion}
                $timeout={$timeout}
                bugClassName={bug.resolution !== "" ? "deleted" : ""}
                title={bug.resolution !== "" ? bug.resolution : ""}
              />))}
          </ul>}

        {(suggestion.bugs.too_many_open_recent || (suggestion.bugs.too_many_all_others
            && !suggestion.valid_open_recent)) &&
            <mark>Exceeded max {BUG_LIMIT} bug suggestions, most of which are likely false positives.</mark>}
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
    bug, suggestion,
    bugClassName, title, $timeout, pinboardService, selectedJob,
  } = props;
  const bugUrl = getBugUrl(bug.id);
  const bugSummaryText = escapeHTML(bug.summary);
  const highlightedTerms = { __html: highlightCommonTerms(bugSummaryText, suggestion.search) };

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
        <span className={`${bugClassName} ml-1`} dangerouslySetInnerHTML={highlightedTerms} />
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


class FailureSummaryTab extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.$timeout = $injector.get('$timeout');
    this.thPinboard = $injector.get('thPinboard');

    this.history = createHistory();
  }

  render() {
    const {
      user, fileBug, jobLogUrls, logParseStatus, suggestions, errors,
      bugSuggestionsLoading, selectedJob
    } = this.props;
    const logs = jobLogUrls;
    const jobLogsAllParsed = logs ? logs.every(jlu => (jlu.parse_status !== 'pending')) : false;

    return (
      <ul className="list-unstyled failure-summary-list" ref={this.fsMount}>
        {suggestions && suggestions.map((suggestion, index) =>
          (<SuggestionsListItem
            key={index}  // eslint-disable-line react/no-array-index-key
            index={index}
            history={this.history}
            suggestion={suggestion}
            user={user}
            fileBug={fileBug}
            pinboardService={this.thPinboard}
            selectedJob={selectedJob}
            $timeout={this.$timeout}
          />))}

        {errors && errors.length > 0 &&
          <ErrorsList errors={errors} />}

        {!bugSuggestionsLoading && jobLogsAllParsed && logs &&
          logs.length === 0 && suggestions.length === 0 && errors.length === 0 &&
          <ListItem text="Failure summary is empty" />}

        {!bugSuggestionsLoading && jobLogsAllParsed && logs && logs.length > 0 &&
          logParseStatus === 'success' &&
          <li>
            <p className="failure-summary-line-empty mb-0">Log parsing complete. Generating bug suggestions.<br />
              <span>The content of this panel will refresh in 5 seconds.</span></p>
          </li>}

        {logs && !bugSuggestionsLoading && !jobLogsAllParsed &&
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

        {!bugSuggestionsLoading && logs && logs.length === 0 &&
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
  suggestions: PropTypes.array,
  fileBug: PropTypes.func,
  user: PropTypes.object,
  selectedJob: PropTypes.object,
  $injector: PropTypes.object,
  errors: PropTypes.array,
  bugSuggestionsLoading: PropTypes.bool,
  // logs: PropTypes.array,
  jobLogUrls: PropTypes.array,
  logParseStatus: PropTypes.string
};

treeherder.directive('failureSummaryTab', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(FailureSummaryTab, undefined, {}, { $injector })]);
