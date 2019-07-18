import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

const LoadingSpinner = () => (
  <div className="loading">
    <FontAwesomeIcon
      icon={faCog}
      size="4x"
      spin
      title="loading page, please wait"
    />
  </div>
);

export default LoadingSpinner;
