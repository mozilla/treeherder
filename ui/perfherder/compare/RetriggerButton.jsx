import React from 'react';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';

import { compareTableText } from '../constants';

export default function RetriggerButton(props) {
  const { onClick, title } = props;

  return (
    <Button
      className="retrigger-btn icon-green mr-1 py-0 px-1"
      title={title}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={faRedo} />
    </Button>
  );
}

RetriggerButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string,
};

RetriggerButton.defaultProps = {
  title: compareTableText.retriggerButtonTitle,
};
