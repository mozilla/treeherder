import React from 'react';
import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug } from '@fortawesome/free-solid-svg-icons';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import { getSearchWords } from '../../../helpers/display';
import { getBugUrl } from '../../../helpers/url';

function BugListItem(props) {
  const {
    bug,
    suggestion,
    bugClassName,
    title,
    selectedJob,
    addBug,
    toggleBugFiler,
  } = props;
  const bugUrl = getBugUrl(bug.id);
  const duplicateBugUrl = bug.dupe_of ? getBugUrl(bug.dupe_of) : undefined;

  return (
    <li data-testid="bug-list-item">
      {!!addBug && (
        <Button
          className="bg-light px-2 py-1"
          outline
          style={{ fontSize: '8px' }}
          type="button"
          onClick={() => addBug(bug, selectedJob)}
          title="add to list of bugs to associate with all pinned jobs"
        >
          <FontAwesomeIcon icon={faThumbtack} title="Select bug" />
        </Button>
      )}
      <span className="ml-1">i{bug.internal_id}</span>
      {!bug.id && (
        <span className="ml-1">
          {bug.summary} ({bug.occurrences} occurrences)
          {bug.occurrences > -1 && (
            // TODO: Update the condition above to match backend configuration
            <Button
              className="bg-light py-1 px-2 ml-2"
              outline
              style={{ fontSize: '8px' }}
              onClick={() => toggleBugFiler(suggestion)}
              title="file a bug for this internal issue"
            >
              <FontAwesomeIcon icon={faBug} title="File bug" />
            </Button>
          )}
        </span>
      )}
      {bug.id && (
        <a
          className={`${bugClassName} ml-1 ${
            bug.resolution !== '' ? 'strike-through' : ''
          }`}
          href={bugUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
        >
          <Highlighter
            className={`${bugClassName} ml-1`}
            searchWords={getSearchWords(suggestion.search)}
            textToHighlight={bug.summary}
            caseSensitive
            highlightTag="strong"
          />{' '}
          (bug {bug.id})
        </a>
      )}
      {bug.dupe_of && (
        <span>
          {' '}
          &gt;
          <a
            className={`${bugClassName} ml-1`}
            href={duplicateBugUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {bug.dupe_of}
          </a>
        </span>
      )}
    </li>
  );
}

BugListItem.propTypes = {
  bug: PropTypes.shape({}).isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  selectedJob: PropTypes.shape({}).isRequired,
  bugClassName: PropTypes.string,
  title: PropTypes.string,
  addBug: PropTypes.func,
  toggleBugFiler: PropTypes.func.isRequired,
};

BugListItem.defaultProps = {
  bugClassName: '',
  title: null,
  addBug: null,
};

export default BugListItem;
