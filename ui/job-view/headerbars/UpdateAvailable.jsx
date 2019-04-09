import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

export default function UpdateAvailable(props) {
  const { updateButtonClick } = props;

  // Show this when the Treeherder server has updated
  return (
    <div className="alert alert-info update-alert-panel">
      <FontAwesomeIcon icon={faInfoCircle} />
      Treeherder has updated. To pick up the changes, you can reload the page
      &nbsp;
      <button
        onClick={updateButtonClick}
        className="btn btn-xs btn-danger"
        type="button"
      >
        Reload
      </button>
    </div>
  );
}

UpdateAvailable.propTypes = {
  updateButtonClick: PropTypes.func.isRequired,
};
