import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBug,
  faCircleExclamation,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../../Clipboard';
import logviewerIcon from '../../../img/logviewerIcon.png';
import { thBugSuggestionLimit } from '../../../helpers/constants';
import { isReftest } from '../../../helpers/job';
import {
  createQueryParams,
  getLogViewerUrl,
  parseQueryParams,
} from '../../../helpers/url';
import formatLogLineWithLinks from '../../../helpers/logFormatting';

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

  getPathFilter = (filterTestPath) => {
    const path = filterTestPath[0].replace(/\/$/, '');
    const filterParams = {
      ...parseQueryParams(window.location.search),
      test_paths: path,
    };

    return `${window.location.pathname}${createQueryParams(filterParams)}`;
  };

  render() {
    const {
      suggestion,
      toggleBugFiler,
      toggleInternalIssueFiler,
      selectedJob,
      jobDetails,
      addBug,
      currentRepo,
      developerMode,
    } = this.props;
    const repoName = currentRepo.name;
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
              key={bug.internal_id}
              bug={bug}
              suggestion={suggestion}
              selectedJob={selectedJob}
              addBug={addBug}
              toggleBugFiler={toggleBugFiler}
              bugClassName={
                developerMode ? 'text-darker-secondary small-text' : ''
              }
              title={bug.resolution !== '' ? bug.resolution : ''}
            />
          ))}
        </ul>,
      );

      // All other bugs
      if (suggestion.valid_all_others) {
        suggestions.push(
          <Button
            key="show-hide-more"
            size="sm"
            variant="outline-dark"
            rel="noopener"
            onClick={this.clickShowMore}
            className={`show-more-suggestions my-2 ${
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
              bugClassName={`${
                developerMode ? 'text-darker-secondary small-text' : ''
              }`}
              title={bug.resolution !== '' ? bug.resolution : ''}
              selectedJob={selectedJob}
              addBug={addBug}
              toggleBugFiler={toggleBugFiler}
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
    const filterTestPath = suggestion.search.match(/([a-z_\-0-9]+[/])+/gi);

    const line = formatLogLineWithLinks(
      suggestion.search,
      jobDetails,
      selectedJob,
    );

    return (
      <li>
        <div>
          {developerMode ? (
            <React.Fragment>
              <Clipboard
                description=" text of error line"
                text={suggestion.search}
              />
              <a
                href={getLogViewerUrl(
                  selectedJob.id,
                  repoName,
                  suggestion.line_number + 1,
                  selectedJob,
                )}
                target="_blank"
                rel="noopener noreferrer"
                title="Go to this line in the log viewer"
              >
                <span className="align-middle link-style font-weight-400 font-size-12">
                  {suggestion.search}
                </span>
              </a>
              <br className="mb-3" />
            </React.Fragment>
          ) : (
            <span>
              <Button
                className="bg-light py-2 px-2 me-2 failure-action-btn"
                variant="outline-secondary"
                onClick={() => toggleInternalIssueFiler(suggestion)}
                title="File an internal issue for this failure"
              >
                <FontAwesomeIcon icon={faCircleExclamation} />
              </Button>

              {suggestion.showNewButton && (
                <Button
                  className="btn-orange border-outline-secondary"
                  title="number of times this error message has been seen until now (including this run)"
                >
                  NEW
                </Button>
              )}

              <span className="align-middle">{line} </span>
              <Clipboard
                description=" text of error line"
                text={suggestion.search}
              />
              {filterTestPath && !developerMode && !isReftest(selectedJob) && (
                <Link
                  to={this.getPathFilter(filterTestPath)}
                  className="px-1 text-darker-secondary"
                  title={`Filter by test path: ${filterTestPath[0]}`}
                >
                  <FontAwesomeIcon icon={faFilter} />
                </Link>
              )}
              <a
                href={getLogViewerUrl(
                  selectedJob.id,
                  repoName,
                  suggestion.line_number + 1,
                  selectedJob,
                )}
                target="_blank"
                rel="noopener noreferrer"
                title="Go to this line in the log viewer"
              >
                <img
                  alt="Logviewer"
                  src={logviewerIcon}
                  className="logviewer-icon ms-1"
                />
              </a>
              <Button
                className="bg-light py-2 px-2 ms-2 failure-action-btn"
                variant="outline-secondary"
                onClick={() => toggleBugFiler(suggestion)}
                title="File a bug for this failure"
              >
                <FontAwesomeIcon icon={faBug} />
              </Button>
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
  suggestion: PropTypes.shape({}).isRequired,
  jobDetails: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ).isRequired,
  toggleBugFiler: PropTypes.func.isRequired,
  toggleInternalIssueFiler: PropTypes.func.isRequired,
  developerMode: PropTypes.bool.isRequired,
  addBug: PropTypes.func,
};

SuggestionsListItem.defaultProps = {
  addBug: null,
};
