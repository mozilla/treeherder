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
      developerMode,
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
              bugClassName={
                developerMode ? 'text-darker-secondary small-text' : ''
              }
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
            className={`bg-light px-2 py-1 btn btn-outline-secondary btn-xs my-2 show-hide-more ${
              developerMode && 'text-darker-secondary small-text'
            }`}
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
              bugClassName={`${bug.resolution !== '' ? 'strike-through' : ''} ${
                developerMode ? 'text-darker-secondary small-text' : ''
              }`}
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
          {developerMode ? (
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
              <span className="align-middle link-style font-weight-500">
                {suggestion.search}
              </span>
            </a>
          ) : (
            <span>
              <Button
                className="bg-light py-1 px-2 mr-2"
                outline
                style={{ fontSize: '8px' }}
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
            </span>
          )}
        </div>
        {suggestions.length > 0 && (
          <React.Fragment>
            {developerMode && (
              <div className="mt-2 mb-1">These bugs may be related:</div>
            )}
            <div className="failure-summary-bugs-container">{suggestions}</div>
          </React.Fragment>
        )}
      </li>
    );
  }
}

SuggestionsListItem.propTypes = {
  selectedJob: PropTypes.shape({}).isRequired,
  suggestion: PropTypes.shape({
    search: PropTypes.string,
    valid_all_others: PropTypes.bool,
    valid_open_recent: PropTypes.bool,
    bugs: PropTypes.shape({
      all_others: PropTypes.array,
      open_recent: PropTypes.array,
      too_many_open_recent: PropTypes.bool,
      too_many_all_others: PropTypes.bool,
    }),
  }).isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
  developerMode: PropTypes.bool.isRequired,
  addBug: PropTypes.func,
};

SuggestionsListItem.defaultProps = {
  addBug: null,
};
