import PropTypes from 'prop-types';
import { Container } from 'react-bootstrap';

import ErrorMessages from '../shared/ErrorMessages';
import LoadingSpinner from '../shared/LoadingSpinner';

const ValidationGate = ({ isLoading, errorMessages, children }) => {
  if (errorMessages.length > 0) {
    return (
      <Container className="pt-5 max-width-default">
        <ErrorMessages errorMessages={errorMessages} />
      </Container>
    );
  }
  if (isLoading) {
    return <LoadingSpinner />;
  }
  return <>{children}</>;
};

ValidationGate.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  errorMessages: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
};

export default ValidationGate;
