import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../../Clipboard';
import logviewerIcon from '../../../img/logviewerIcon.png';
import { thBugSuggestionLimit } from '../../../helpers/constants';
import { getLogViewerUrl } from '../../../helpers/url';

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

  render() {
    const {
      suggestion,
      toggleBugFiler,
      selectedJob,
      addBug,
      repoName,
    } = this.props;
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
              selectedJob={selectedJob}
              addBug={addBug}
            />
          ))}
        </ul>,
      );

      // All other bugs
      if (suggestion.valid_all_others) {
        suggestions.push(
          <Button
            key="show-hide-more"
            color="link"
            rel="noopener"
            onClick={this.clickShowMore}
            className="bg-light px-2 py-1 btn btn-outline-secondary btn-xs my-2 show-hide-more"
          >
            {suggestionShowMore
              ? 'Hide bug suggestions'
              : 'Show more bug suggestions'}
          </Button>,
        );
      }
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
              selectedJob={selectedJob}
              addBug={addBug}
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

    return (
      <li>
        <div>
          <Button
            className="bg-light py-1 px-2 mr-2"
            outline
            size="xs"
            onClick={() => toggleBugFiler(suggestion)}
            title="file a bug for this failure"
          >
            <FontAwesomeIcon icon={faBug} title="File bug" />
          </Button>
          <span className="align-middle">{suggestion.search} </span>
          <Clipboard
            description=" text of error line"
            text={suggestion.search}
          />
          <a
            href={getLogViewerUrl(
              selectedJob.id,
              repoName,
              suggestion.line_number + 1,
            )}
            target="_blank"
            rel="noopener noreferrer"
            title="Go to this line in the log viewer"
          >
            <img
              alt="Logviewer"
              src={logviewerIcon}
              className="logviewer-icon ml-1"
            />
          </a>
        </div>
        {suggestions.length > 0 && (
          <div className="failure-summary-bugs-container">
            <h4 className="failure-summary-bugs-title">
              These bugs may be related:
            </h4>
            {suggestions}
          </div>
        )}
      </li>
    );
  }
}

SuggestionsListItem.propTypes = {
  selectedJob: PropTypes.shape({}).isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
  addBug: PropTypes.func,
};

SuggestionsListItem.defaultProps = {
  addBug: null,
};
