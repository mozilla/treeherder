/* eslint-disable jsx-a11y/no-static-element-interactions */

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
      <span
        type="button"
        className="pointer"
        onClick={() => Clipboard.copyToClipboard(text)}
      >
        <FontAwesomeIcon icon={faClipboard} title={title} />
      </span>
    );
  }
}
