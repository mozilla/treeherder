import React from 'react';
import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import { getSearchWords } from '../../../helpers/display';
import { getBugUrl } from '../../../helpers/url';

function BugListItem(props) {
  const { bug, suggestion, bugClassName, title, selectedJob, addBug } = props;
  const bugUrl = getBugUrl(bug.id);

  return (
    <li>
      {!!addBug && (
        <Button
          className="bg-light px-2 py-1"
          outline
          size="xs"
          type="button"
          onClick={() => addBug(bug, selectedJob)}
          title="add to list of bugs to associate with all pinned jobs"
        >
          <FontAwesomeIcon icon={faThumbtack} title="Select bug" />
        </Button>
      )}
      <a
        className={`${bugClassName} ml-1`}
        href={bugUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
      >
        {bug.id}
        <Highlighter
          className={`${bugClassName} ml-1`}
          searchWords={getSearchWords(suggestion.search)}
          textToHighlight={bug.summary}
          caseSensitive
          highlightTag="strong"
        />
      </a>
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
};

BugListItem.defaultProps = {
  bugClassName: '',
  title: null,
  addBug: null,
};

export default BugListItem;
