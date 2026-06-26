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
import { isReftest } from '../../../../helpers/job';
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
}) => {
  const filterTestPath = suggestion.search.match(/([a-z_\-0-9]+[/])+/gi);
  const line = formatLogLineWithLinks(
    suggestion.search,
    jobDetails,
    selectedJob,
  );

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
};

export default SummaryItem;
