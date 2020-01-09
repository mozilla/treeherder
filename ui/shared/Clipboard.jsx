import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';

export default class Clipboard extends React.PureComponent {
  static copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  render() {
    const { title, text } = this.props;

    return (
      <button
        type="button"
        title={title}
        onClick={() => Clipboard.copyToClipboard(text)}
      >
        <FontAwesomeIcon icon={faClipboard} />
      </button>
    );
  }
}
