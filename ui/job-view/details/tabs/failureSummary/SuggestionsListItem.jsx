import React from 'react';
import PropTypes from 'prop-types';

import { thBugSuggestionLimit } from '../../../../js/constants';

import BugListItem from './BugListItem';

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
      suggestion, selectedJob, toggleBugFiler, addBug,
    } = this.props;
    const { suggestionShowMore } = this.state;

    return (
      <li>
        <div>
          <span
            className="btn btn-xs btn-light-bordered link-style"
            onClick={() => toggleBugFiler(suggestion)}
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
              suggestion={suggestion}
              addBug={addBug}
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
                suggestion={suggestion}
                bugClassName={bug.resolution !== '' ? 'deleted' : ''}
                title={bug.resolution !== '' ? bug.resolution : ''}
                addBug={addBug}
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
  addBug: PropTypes.func.isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
};
