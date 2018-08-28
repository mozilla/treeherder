import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';
import { processErrorMessage } from './helpers';

const ErrorMessages = (props) => {
  const messages = processErrorMessage(props.failureMessage, props.failureStatus);
  return (
    <div>
      {messages.map(message =>
        <Alert color="danger" key={message}>{message}</Alert>,
      )}
    </div>
  );
};

ErrorMessages.propTypes = {
  failureMessage: PropTypes.object,
  failureStatus: PropTypes.number,
};

ErrorMessages.defaultProps = {
  failureMessage: null,
  failureStatus: null,
};

export default ErrorMessages;
