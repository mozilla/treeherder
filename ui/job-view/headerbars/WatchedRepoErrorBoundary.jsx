import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class WatchedRepoErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      errorInfo: {},
    };
  }

  componentDidCatch(error, info) {
    this.setState({
      hasError: true,
      errorInfo: info,
    });
  }

  render() {
    const { hasError } = this.state;
    const { repoName } = this.props;

    if (hasError) {
      return (
        <span className="btn-view-nav pl-1 pr-1 border-right">Error getting {repoName} info</span>
      );
    }
    return this.props.children;
  }
}

WatchedRepoErrorBoundary.propTypes = {
  children: PropTypes.object.isRequired,
  repoName: PropTypes.string,
};

WatchedRepoErrorBoundary.defaultProps = {
  // In case the repoName is undefined due to some other error.
  repoName: 'unknown',
};
