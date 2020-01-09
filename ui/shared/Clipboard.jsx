import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';

const Clipboard = ({ description, text }) => {
  const copyToClipboard = () => navigator.clipboard.writeText(text);

  return (
    <button
      type="button"
      title={`Copy ${description}`}
      onClick={copyToClipboard}
    >
      <FontAwesomeIcon icon={faClipboard} />
    </button>
  );
};

Clipboard.propTypes = {
  description: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
};

export { Clipboard as default };
