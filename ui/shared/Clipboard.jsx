import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';

const Clipboard = ({ description, text }) => {
  if (!text) {
    return null;
  }

  const copyToClipboard = () => navigator.clipboard.writeText(text);

  return (
    <button
      type="button"
      title={`Copy ${description}`}
      onClick={copyToClipboard}
      className="px-1 mx-1"
    >
      <FontAwesomeIcon icon={faClipboard} />
    </button>
  );
};

Clipboard.propTypes = {
  description: PropTypes.string.isRequired,
  text: PropTypes.string,
};

Clipboard.defaultProps = {
  text: null,
};

export { Clipboard as default };
