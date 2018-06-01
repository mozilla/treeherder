import React from 'react';
import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';

import { getBugUrl } from '../../../../helpers/url';
import { getSearchWords } from '../../../../helpers/display';

export default function BugListItem(props) {
  const {
    bug, suggestion,
    bugClassName, title, $timeout, pinboardService, selectedJob,
  } = props;
  const bugUrl = getBugUrl(bug.id);

  return (
    <li>
      <button
        className="btn btn-xs btn-light-bordered"
        onClick={() => $timeout(() => pinboardService.addBug(bug, selectedJob))}
        title="add to list of bugs to associate with all pinned jobs"
      >
        <i className="fa fa-thumb-tack" />
      </button>
      <a
        className={`${bugClassName} ml-1`}
        href={bugUrl}
        target="_blank"
        rel="noopener"
        title={title}
      >{bug.id}
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
  bug: PropTypes.object.isRequired,
  suggestion: PropTypes.object.isRequired,
  $timeout: PropTypes.func.isRequired,
  pinboardService: PropTypes.object.isRequired,
  selectedJob: PropTypes.object.isRequired,
  bugClassName: PropTypes.string,
  title: PropTypes.string,
};

BugListItem.defaultProps = {
  bugClassName: '',
  title: null,
};
