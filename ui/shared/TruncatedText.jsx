import React from 'react';
import PropTypes from 'prop-types';

export default class TruncatedText extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showMoreResults: false,
    };
  }

  render() {
    const { text, maxLength, title, showMoreClass } = this.props;
    const { showMoreResults } = this.state;

    return (
      <React.Fragment>
        <p className={showMoreResults ? '' : 'text-truncate'}>
          {title && <span className="font-weight-bold">{title}</span>}
          {text}
        </p>
        {text.length > maxLength && (
          <p
            className={`${showMoreClass} mb-0 text-right  pointer`}
            onClick={() => this.setState({ showMoreResults: !showMoreResults })}
          >
            {`show ${showMoreResults ? 'less' : 'more'}`}
          </p>
        )}
      </React.Fragment>
    );
  }
}

TruncatedText.propTypes = {
  text: PropTypes.string.isRequired,
  title: PropTypes.string,
  maxLength: PropTypes.number.isRequired,
  showMoreClass: PropTypes.string,
};

TruncatedText.defaultProps = {
  showMoreClass: 'font-weight-bold',
  title: '',
};
