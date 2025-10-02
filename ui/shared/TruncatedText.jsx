import React from 'react';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

export default class TruncatedText extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showMoreResults: false,
    };
  }

  render() {
    const { text, maxLength, title, color } = this.props;
    const { showMoreResults } = this.state;

    const isOutline = color !== 'link';
    const variant = isOutline ? `outline-${color}` : color;

    return (
      <React.Fragment>
        <p className={showMoreResults ? '' : 'text-truncate'}>
          {title && <span className="font-weight-bold">{title}</span>}
          <span className="multiline-text">{text}</span>
        </p>
        {text.length > maxLength && (
          <Button
            variant={variant}
            className={`${
              color !== 'link' || 'font-weight-bold text-reset'
            } d-block ms-auto`}
            onClick={() => this.setState({ showMoreResults: !showMoreResults })}
          >
            {`show ${showMoreResults ? 'less' : 'more'}`}
          </Button>
        )}
      </React.Fragment>
    );
  }
}

TruncatedText.propTypes = {
  text: PropTypes.string.isRequired,
  title: PropTypes.string,
  maxLength: PropTypes.number.isRequired,
  color: PropTypes.string,
};

TruncatedText.defaultProps = {
  title: '',
  color: 'link',
};
