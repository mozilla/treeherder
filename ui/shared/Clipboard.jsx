import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import { Button } from 'reactstrap';

const Clipboard = ({ description, text, outline, visible }) => {
  if (!text) {
    return null;
  }

  const copyToClipboard = () => navigator.clipboard.writeText(text);

  // This adapts automatically when the system theme changes light/dark
  const colorTheme = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'light'
      : 'dark';

  return (
    <Button
      type="button"
      title={`Copy ${description}`}
      onClick={copyToClipboard}
      className={`py-0 px-1 ${visible ? '' : 'invisible'}`}
      color={colorTheme()}
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
  visible: PropTypes.bool,
};

Clipboard.defaultProps = {
  text: null,
  outline: false,
  visible: true,
};

export { Clipboard as default };
