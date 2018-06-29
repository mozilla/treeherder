import React from 'react';
import PropTypes from 'prop-types';

export default function UpdateAvailable(props) {
  const { updateButtonClick } = props;

  // Show this when the Treeherder server has updated
  return (
    <div className="alert alert-info update-alert-panel">
      <i className="fa fa-info-circle" aria-hidden="true" />
      Treeherder has updated. To pick up the changes, you can reload the page &nbsp;
      <button
        onClick={updateButtonClick}
        className="btn btn-xs btn-danger"
        type="button"
      >Reload</button>
    </div>
  );
}

UpdateAvailable.propTypes = {
  updateButtonClick: PropTypes.func.isRequired,
};
