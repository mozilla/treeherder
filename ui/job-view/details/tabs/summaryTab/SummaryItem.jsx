import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBug,
  faCircleExclamation,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../../../../shared/Clipboard';
import BugListItem from '../../../../shared/tabs/failureSummary/BugListItem';
import { isReftest } from '../../../../helpers/job';
import { thBugSuggestionLimit } from '../../../../helpers/constants';
import {
  createQueryParams,
  parseQueryParams,
} from '../../../../helpers/url';
import formatLogLineWithLinks from '../../../../helpers/logFormatting';

const getPathFilter = (filterTestPath) => {
  const path = filterTestPath[0].replace(/\/$/, '');
  const filterParams = {
    ...parseQueryParams(window.location.search),
    test_paths: path,
  };

  return `${window.location.pathname}${createQueryParams(filterParams)}`;
};

const SummaryItem = ({
  suggestion,
  toggleBugFiler,
  toggleInternalIssueFiler,
  selectedJob,
  jobDetails,
  addBug = null,
}) => {
  const [showMore, setShowMore] = useState(false);
  const filterTestPath = suggestion.search.match(/([a-z_\-0-9]+[/])+/gi);
  const line = formatLogLineWithLinks(
    suggestion.search,
    jobDetails,
    selectedJob,
  );

  const { bugs } = suggestion;
  const showOpenRecent = suggestion.valid_open_recent;
  const showAllOthers =
    suggestion.valid_all_others && (showMore || !showOpenRecent);
  const tooMany =
    bugs?.too_many_open_recent ||
    (bugs?.too_many_all_others && !suggestion.valid_open_recent);

  return (
    <li>
      <div>
        <span>
          <Button
            className="bg-light py-2 px-2 me-2 failure-action-btn"
            variant="outline-secondary"
            onClick={() => toggleInternalIssueFiler(suggestion)}
            title="File an internal issue for this failure"
          >
            <FontAwesomeIcon icon={faCircleExclamation} />
          </Button>
          <span className="align-middle">{line} </span>
          <Clipboard description=" text of error line" text={suggestion.search} />
          {filterTestPath && !isReftest(selectedJob) && (
            <Link
              to={getPathFilter(filterTestPath)}
              className="px-1 text-darker-secondary"
              title={`Filter by test path: ${filterTestPath[0]}`}
            >
              <FontAwesomeIcon icon={faFilter} />
            </Link>
          )}
          <Button
            className="bg-light py-2 px-2 ms-2 failure-action-btn"
            variant="outline-secondary"
            onClick={() => toggleBugFiler(suggestion)}
            title="File a bug for this failure"
          >
            <FontAwesomeIcon icon={faBug} />
          </Button>
        </span>
      </div>
      {suggestion.showBugSuggestions && (
        <div className="failure-summary-bugs-container">
          {showOpenRecent && (
            <ul className="list-unstyled failure-summary-bugs">
              {bugs.open_recent.map((bug) => (
                <BugListItem
                  key={bug.internal_id ?? bug.id}
                  bug={bug}
                  suggestion={suggestion}
                  selectedJob={selectedJob}
                  addBug={addBug}
                  toggleBugFiler={toggleBugFiler}
                  title={bug.resolution !== '' ? bug.resolution : ''}
                />
              ))}
            </ul>
          )}
          {showOpenRecent && suggestion.valid_all_others && (
            <Button
              size="sm"
              variant="outline-dark"
              rel="noopener"
              onClick={() => setShowMore((prev) => !prev)}
              className="show-more-suggestions my-2"
            >
              {showMore ? 'Hide bug suggestions' : 'Show more bug suggestions'}
            </Button>
          )}
          {showAllOthers && (
            <ul className="list-unstyled failure-summary-bugs">
              {bugs.all_others.map((bug) => (
                <BugListItem
                  key={bug.id ?? bug.internal_id}
                  bug={bug}
                  suggestion={suggestion}
                  selectedJob={selectedJob}
                  addBug={addBug}
                  toggleBugFiler={toggleBugFiler}
                  title={bug.resolution !== '' ? bug.resolution : ''}
                />
              ))}
            </ul>
          )}
          {tooMany && (
            <mark>
              Exceeded max {thBugSuggestionLimit} bug suggestions, most of which
              are likely false positives.
            </mark>
          )}
        </div>
      )}
    </li>
  );
};

SummaryItem.propTypes = {
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
  addBug: PropTypes.func,
};

export default SummaryItem;
