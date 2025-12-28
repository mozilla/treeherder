
import { Container, Row, Col, Alert } from 'react-bootstrap';

const NotFound = () => (
  <Container fluid style={{ marginTop: 40 }}>
    <Row>
      <Col>
        <Alert variant="danger">
          Missing required URL parameters of <code>repo</code> and{' '}
          <code>revision</code>.
        </Alert>
      </Col>
    </Row>
  </Container>
);

export default NotFound;
