import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';

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
          <Button
            className="bg-transparent border-0 p-0"
            size="sm"
            onClick={() => this.setState({ showMoreResults: !showMoreResults })}
          >
            <p className={`${showMoreClass} mb-0 text-right  pointer`}>
              {`show ${showMoreResults ? 'less' : 'more'}`}
            </p>
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
  showMoreClass: PropTypes.string,
};

TruncatedText.defaultProps = {
  showMoreClass: 'font-weight-bold',
  title: '',
};
