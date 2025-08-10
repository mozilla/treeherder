import React from 'react';
import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'react-bootstrap';

import { getSearchWords } from '../../../helpers/display';
import { getBugUrl } from '../../../helpers/url';
import { requiredInternalOccurrences } from '../../../helpers/constants';

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
  const internalOccurrenceButton = (
    <Button
      className="bg-light px-2 py-1"
      variant="outline-secondary"
      style={{ fontSize: '8px' }}
      type="button"
      onClick={() => addBug(bug, selectedJob)}
      title="Add to list of bugs to associate with all pinned jobs"
    >
      <FontAwesomeIcon icon={faThumbtack} title="Select bug" />
    </Button>
  );
  const bugzillaButton = (
    <Button
      className="bg-light py-1 px-2"
      variant="outline-secondary"
      style={{ fontSize: '8px' }}
      onClick={() => toggleBugFiler(suggestion)}
      title={
        bug.occurrences < requiredInternalOccurrences
          ? `Force file a bug (${bug.occurrences}/${requiredInternalOccurrences} occurrences)`
          : 'File a bug for this internal issue'
      }
    >
      <FontAwesomeIcon icon={faBug} />
    </Button>
  );

  return (
    <li data-testid="bug-list-item">
      {!!addBug &&
        bug.occurrences < requiredInternalOccurrences &&
        internalOccurrenceButton}
      {!bug.bugzilla_id &&
        bug.occurrences >= requiredInternalOccurrences &&
        bugzillaButton}
      {bug.bugzilla_id}
      <span className="ml-1">i{bug.internal_id}</span>
      {!bug.id && (
        <span>
          <span className="ml-1" title="Number of recent classifications">
            ({bug.occurrences} occurrences{' '}
            <FontAwesomeIcon icon={faThumbtack} />)
          </span>{' '}
          <span className="mr-2">{bug.summary}</span>
          {!!addBug &&
            bug.occurrences >= requiredInternalOccurrences &&
            internalOccurrenceButton}
          {!bug.bugzilla_id &&
            bug.occurrences < requiredInternalOccurrences &&
            bugzillaButton}
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
