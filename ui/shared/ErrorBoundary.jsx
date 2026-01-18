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
    const { children = null, errorClasses = '', message = '' } = this.props;
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
  children: PropTypes.node,
  errorClasses: PropTypes.string,
  message: PropTypes.string,
};
