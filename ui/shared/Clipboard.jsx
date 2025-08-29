import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboard,
  faCheckCircle,
} from '@fortawesome/free-regular-svg-icons';
import { Button } from 'react-bootstrap';

export default class Clipboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      copied: false,
    };
  }

  copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });

    setTimeout(() => {
      this.setState({ copied: false });
    }, 700);
  };

  render() {
    const { description, text, outline, color } = this.props;
    const { copied } = this.state;

    if (!text) {
      return null;
    }

    const baseColor = color || 'light';
    const variant = outline ? `outline-${baseColor}` : baseColor;

    return (
      <Button
        type="button"
        title={`Copy ${description}`}
        onClick={() => {
          this.copyToClipboard(text);
        }}
        className="py-0 px-1"
        variant={variant}
      >
        {copied ? (
          <FontAwesomeIcon icon={faCheckCircle} variant="#2da745" />
        ) : (
          <FontAwesomeIcon icon={faClipboard} />
        )}
      </Button>
    );
  }
}

Clipboard.propTypes = {
  description: PropTypes.string.isRequired,
  text: PropTypes.string,
  outline: PropTypes.bool,
};

Clipboard.defaultProps = {
  text: null,
  outline: false,
};
