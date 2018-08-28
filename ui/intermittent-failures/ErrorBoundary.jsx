import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { hasError } from './redux/actions';
import { prettyErrorMessages } from './constants';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch() {
    const { errorFound, stateName } = this.props;

    // display fallback UI and reset isFetching to turn off the loading spinner
    this.setState({ hasError: true }, () => errorFound(stateName));

    // TODO: set up a logger to record error and { componentStack }
  }

  render() {
    if (this.state.hasError) {
      return <p className="text-danger py-2">{prettyErrorMessages.default}</p>;
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  stateName: PropTypes.string.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.bool,
  ]),
  errorFound: PropTypes.func.isRequired,
};

ErrorBoundary.defaultProps = {
  children: null,
};

const mapDispatchToProps = dispatch => ({
  errorFound: name => dispatch(hasError(name)),
});

export default connect(null, mapDispatchToProps)(ErrorBoundary);
