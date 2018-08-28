import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class PushErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }
  componentDidCatch(error) {
    this.setState({
      hasError: true,
      error,
    });
  }
  render() {
    const { hasError, error } = this.state;
    const { revision } = this.props;

    if (hasError) {
      return (
        <div className="border-bottom border-top ml-1">
          <div>Error displaying push with revision: {revision}</div>
          <div>{error.toString()}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

PushErrorBoundary.propTypes = {
  children: PropTypes.object.isRequired,
  revision: PropTypes.string,
};

PushErrorBoundary.defaultProps = {
  revision: 'Unknown',
};
