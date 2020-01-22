import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import { Button } from 'reactstrap';

const Clipboard = ({ description, text, outline }) => {
  if (!text) {
    return null;
  }

  const copyToClipboard = () => navigator.clipboard.writeText(text);

  return (
    <Button
      type="button"
      title={`Copy ${description}`}
      onClick={copyToClipboard}
      className="py-0 px-1"
      color="light"
      outline={outline}
    >
      <FontAwesomeIcon icon={faClipboard} />
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
