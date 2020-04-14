import React from 'react';
import PropTypes from 'prop-types';

export default function ErrorsList(props) {
  const errorListItem = props.errors.map((error, key) => (
    <li
      key={key} // eslint-disable-line react/no-array-index-key
    >
      {error.name} : {error.result}.
      <a
        title="Open in Log Viewer"
        target="_blank"
        rel="noopener noreferrer"
        href={error.logViewerUrl}
      >
        <span className="ml-1">View log</span>
      </a>
    </li>
  ));

  return (
    <li>
      No Bug Suggestions Available.
      <br />
      <span className="font-weight-bold">Unsuccessful Execution Steps</span>
      <ul>{errorListItem}</ul>
    </li>
  );
}

ErrorsList.propTypes = {
  errors: PropTypes.arrayOf(PropTypes.object).isRequired,
};
