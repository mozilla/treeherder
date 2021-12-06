import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboard,
  faCheckCircle,
} from '@fortawesome/free-regular-svg-icons';
import { Button } from 'reactstrap';

const Clipboard = ({ description, text, outline, color }) => {
  const [copied, setCopied] = useState(false);

  if (!text) {
    return null;
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 700);
  };

  return (
    <Button
      type="button"
      title={`Copy ${description}`}
      onClick={copyToClipboard}
      className="py-0 px-1"
      color={`${color || 'light'}`}
      outline={outline}
    >
      {copied ? (
        <FontAwesomeIcon icon={faCheckCircle} color="#2da745" />
      ) : (
        <FontAwesomeIcon icon={faClipboard} />
      )}
    </Button>
  );
};

Clipboard.propTypes = {
  description: PropTypes.string.isRequired,
  text: PropTypes.string,
  outline: PropTypes.bool,
};

Clipboard.defaultProps = {
  text: null,
  outline: false,
};

export { Clipboard as default };
