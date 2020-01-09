import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';

const Clipboard = ({ title, text }) => {
  const copyToClipboard = () => navigator.clipboard.writeText(text);

  return (
    <button type="button" title={title} onClick={copyToClipboard}>
      <FontAwesomeIcon icon={faClipboard} />
    </button>
  );
};

export { Clipboard as default };
