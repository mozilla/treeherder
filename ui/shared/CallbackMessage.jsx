import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

import ErrorMessages from './ErrorMessages';

const CallbackMessage = ({ errorMessage, text }) => (
  <div className="pt-5">
    {errorMessage ? (
      <ErrorMessages failureMessage={errorMessage} />
    ) : (
      <Row className="justify-content-center">
        <p className="lead text-center">{text}</p>
      </Row>
    )}
  </div>
);

CallbackMessage.propTypes = {
  errorMessage: PropTypes.string,
  text: PropTypes.string.isRequired,
};

CallbackMessage.defaultProps = {
  errorMessage: '',
};

export default CallbackMessage;
