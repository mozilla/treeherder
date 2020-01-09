import React from 'react';
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

export { Clipboard as default };
