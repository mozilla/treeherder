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
    const {
      description,
      text = null,
      outline = false,
      color,
      variant,
    } = this.props;
    const { copied } = this.state;

    if (!text) {
      return null;
    }

    let buttonVariant;
    let buttonStyle = {};
    let iconClassName = '';

    if (variant === 'transparent') {
      buttonVariant = 'link';
      buttonStyle = { backgroundColor: 'transparent', border: 'none' };
      iconClassName = 'text-dark';
    } else if (variant) {
      buttonVariant = variant;
    } else {
      const baseColor = color || 'light';
      buttonVariant = outline ? `outline-${baseColor}` : baseColor;
    }

    return (
      <Button
        type="button"
        title={`Copy ${description}`}
        onClick={() => {
          this.copyToClipboard(text);
        }}
        className="py-0 px-1"
        variant={buttonVariant}
        style={buttonStyle}
      >
        {copied ? (
          <FontAwesomeIcon
            icon={faCheckCircle}
            className={iconClassName}
            style={{ color: '#2da745' }}
          />
        ) : (
          <FontAwesomeIcon icon={faClipboard} className={iconClassName} />
        )}
      </Button>
    );
  }
}

Clipboard.propTypes = {
  description: PropTypes.string.isRequired,
  text: PropTypes.string,
  outline: PropTypes.bool,
  color: PropTypes.string,
  variant: PropTypes.string,
};
