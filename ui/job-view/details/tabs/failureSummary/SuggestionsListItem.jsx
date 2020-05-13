import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug } from '@fortawesome/free-solid-svg-icons';

import { thBugSuggestionLimit } from '../../../../helpers/constants';

import BugListItem from './BugListItem';

export default class SuggestionsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionShowMore: false,
    };
  }

  clickShowMore = () => {
    this.setState((prevState) => ({
      suggestionShowMore: !prevState.suggestionShowMore,
    }));
  };

  renderBugSuggestions() {
    const { suggestion, selectedJobFull } = this.props;
    const { suggestionShowMore } = this.state;

    const suggestions = [];

    // Open recent bugs
    if (suggestion.valid_open_recent) {
      suggestions.push(
        <ul
          className="list-unstyled failure-summary-bugs"
          key="open-recent-bugs"
        >
          {suggestion.bugs.open_recent.map((bug) => (
            <BugListItem
              key={bug.id}
              bug={bug}
              suggestion={suggestion}
              selectedJobFull={selectedJobFull}
            />
          ))}
        </ul>,
      );
    }

    // All other bugs
    if (suggestion.valid_all_others && suggestion.valid_open_recent) {
      suggestions.push(
        <Button
          key="show-hide-more"
          color="link"
          rel="noopener"
          onClick={this.clickShowMore}
          className="show-hide-more"
        >
          Show / Hide more
        </Button>,
      );
    }

    if (
      suggestion.valid_all_others &&
      (suggestionShowMore || !suggestion.valid_open_recent)
    ) {
      suggestions.push(
        <ul className="list-unstyled failure-summary-bugs" key="all-others">
          {suggestion.bugs.all_others.map((bug) => (
            <BugListItem
              key={bug.id}
              bug={bug}
              suggestion={suggestion}
              bugClassName={bug.resolution !== '' ? 'strike-through' : ''}
              title={bug.resolution !== '' ? bug.resolution : ''}
              selectedJobFull={selectedJobFull}
            />
          ))}
        </ul>,
      );
    }

    if (
      suggestion.bugs.too_many_open_recent ||
      (suggestion.bugs.too_many_all_others && !suggestion.valid_open_recent)
    ) {
      suggestions.push(
        <mark key="too-many">
          Exceeded max {thBugSuggestionLimit} bug suggestions, most of which are
          likely false positives.
        </mark>,
      );
    }

    return suggestions;
  }

  render() {
    const { suggestion, toggleBugFiler } = this.props;

    return (
      <li>
        <div>
          <Button
            className="bg-light py-1 px-2"
            outline
            size="xs"
            onClick={() => toggleBugFiler(suggestion)}
            title="file a bug for this failure"
          >
            <FontAwesomeIcon icon={faBug} title="File bug" />
          </Button>
          <span>{suggestion.search}</span>
        </div>
        {this.renderBugSuggestions()}
      </li>
    );
  }
}

SuggestionsListItem.propTypes = {
  selectedJobFull: PropTypes.shape({}).isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
};
