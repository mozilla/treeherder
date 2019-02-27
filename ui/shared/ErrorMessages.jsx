import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';

const ErrorMessages = ({ failureMessage, errorMessages }) => {
  const messages = errorMessages.length ? errorMessages : [failureMessage];

  return (
    <div>
      {messages.map(message => (
        <Alert color="danger" key={message}>
          {message}
        </Alert>
      ))}
    </div>
  );
};

ErrorMessages.propTypes = {
  failureMessage: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  errorMessages: PropTypes.arrayOf(PropTypes.string),
};

ErrorMessages.defaultProps = {
  failureMessage: null,
  errorMessages: [],
};

export default ErrorMessages;
