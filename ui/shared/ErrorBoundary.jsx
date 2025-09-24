import React from 'react';
import PropTypes from 'prop-types';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  componentDidCatch(error) {
    this.setState({
      hasError: true,
      error,
    });
  }

  render() {
    const { children, errorClasses, message } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      return (
        <span className={errorClasses}>
          {message} {error.toString()}
        </span>
      );
    }
    return children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
  errorClasses: PropTypes.string,
  message: PropTypes.string,
};

ErrorBoundary.defaultProps = {
  errorClasses: '',
  message: '',
  children: null,
};
