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
    this.setState(prevState => ({
      suggestionShowMore: !prevState.suggestionShowMore,
    }));
  };

  render() {
    const { suggestion, toggleBugFiler, selectedJobFull } = this.props;
    const { suggestionShowMore } = this.state;

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

        {/* <!--Open recent bugs--> */}
        {suggestion.valid_open_recent && (
          <ul className="list-unstyled failure-summary-bugs">
            {suggestion.bugs.open_recent.map(bug => (
              <BugListItem
                key={bug.id}
                bug={bug}
                suggestion={suggestion}
                selectedJobFull={selectedJobFull}
              />
            ))}
          </ul>
        )}

        {/* <!--All other bugs--> */}
        {suggestion.valid_all_others && suggestion.valid_open_recent && (
          <Button
            color="link"
            rel="noopener"
            onClick={this.clickShowMore}
            className="show-hide-more"
          >
            Show / Hide more
          </Button>
        )}

        {suggestion.valid_all_others &&
          (suggestionShowMore || !suggestion.valid_open_recent) && (
            <ul className="list-unstyled failure-summary-bugs">
              {suggestion.bugs.all_others.map(bug => (
                <BugListItem
                  key={bug.id}
                  bug={bug}
                  suggestion={suggestion}
                  bugClassName={bug.resolution !== '' ? 'strike-through' : ''}
                  title={bug.resolution !== '' ? bug.resolution : ''}
                  selectedJobFull={selectedJobFull}
                />
              ))}
            </ul>
          )}

        {(suggestion.bugs.too_many_open_recent ||
          (suggestion.bugs.too_many_all_others &&
            !suggestion.valid_open_recent)) && (
          <mark>
            Exceeded max {thBugSuggestionLimit} bug suggestions, most of which
            are likely false positives.
          </mark>
        )}
      </li>
    );
  }
}

SuggestionsListItem.propTypes = {
  selectedJobFull: PropTypes.shape({}).isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
};
