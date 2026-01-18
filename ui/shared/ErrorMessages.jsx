import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

class ErrorMessages extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      visible: true,
    };
  }

  componentDidUpdate(prevProps) {
    const { errorMessages = [], failureMessage = null } = this.props;
    if (
      (prevProps.errorMessages !== errorMessages ||
        prevProps.failureMessage !== failureMessage) &&
      !this.state.visible
    ) {
      // reset Alert if previouly dismissed

      this.setState({ visible: true });
    }
  }

  render() {
    const { errorMessages = [], failureMessage = null } = this.props;
    const { visible } = this.state;

    const messages = errorMessages.length ? errorMessages : [failureMessage];
    return (
      <div>
        {messages.map((message) => (
          <Alert
            variant="danger"
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

export default ErrorMessages;
