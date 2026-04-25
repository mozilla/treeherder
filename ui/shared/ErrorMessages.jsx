import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

const ErrorMessages = ({ errorMessages = [], failureMessage = null }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [errorMessages, failureMessage]);

  const messages = errorMessages.length ? errorMessages : [failureMessage];

  return (
    <div>
      {messages.map((message) => (
        <Alert
          variant="danger"
          show={visible}
          onClose={() => setVisible((v) => !v)}
          dismissible
          key={message}
          className="text-center"
        >
          {message}
        </Alert>
      ))}
    </div>
  );
};

ErrorMessages.propTypes = {
  failureMessage: PropTypes.string,
  errorMessages: PropTypes.arrayOf(PropTypes.string),
};

export default ErrorMessages;
