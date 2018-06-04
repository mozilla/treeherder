import React from 'react';
import PropTypes from 'prop-types';

import BugListItem from './BugListItem';
import { thBugSuggestionLimit } from '../../../../js/constants';

export default class SuggestionsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionShowMore: false,
    };

    this.clickShowMore = this.clickShowMore.bind(this);
  }

  clickShowMore() {
    this.setState({ suggestionShowMore: !this.state.suggestionShowMore });
  }

  render() {
    const {
      suggestion, selectedJob, $timeout, pinboardService, fileBug, index
    } = this.props;
    const { suggestionShowMore } = this.state;

    return (
      <li>
        <div className="job-tabs-content">
          <span
            className="btn btn-xs btn-light-bordered link-style"
            onClick={() => fileBug(index)}
            title="file a bug for this failure"
          >
            <i className="fa fa-bug" />
          </span>
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
            <mark>Exceeded max {thBugSuggestionLimit} bug suggestions, most of which are likely false positives.</mark>}
      </li>
    );
  }
}

SuggestionsListItem.propTypes = {
  suggestion: PropTypes.object.isRequired,
  selectedJob: PropTypes.object.isRequired,
  $timeout: PropTypes.func.isRequired,
  pinboardService: PropTypes.object.isRequired,
  fileBug: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
};
