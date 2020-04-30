import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';

class ErrorMessages extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      visible: true,
    };
  }

  componentDidUpdate(prevProps) {
    const { errorMessages, failureMessage } = this.props;
    if (
      (prevProps.errorMessages !== errorMessages ||
        prevProps.failureMessage !== failureMessage) &&
      !this.state.visible
    ) {
      // reset Alert if previouly dismissed
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ visible: true });
    }
  }

  render() {
    const { errorMessages, failureMessage } = this.props;
    const { visible } = this.state;

    const messages = errorMessages.length ? errorMessages : [failureMessage];
    return (
      <div>
        {messages.map((message) => (
          <Alert
            color="danger"
            isOpen={visible}
            toggle={() => this.setState({ visible: !visible })}
            key={message}
            className="text-center"
          >
            {message}
          </Alert>
        ))}
      </div>
    );
  }
}

ErrorMessages.propTypes = {
  failureMessage: PropTypes.string,
  errorMessages: PropTypes.arrayOf(PropTypes.string),
};

ErrorMessages.defaultProps = {
  failureMessage: null,
  errorMessages: [],
};

export default ErrorMessages;
