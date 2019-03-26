import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Alert } from 'reactstrap';

export default class ResultsAlert extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showMoreResults: false,
    };
  }

  render() {
    const { testsNoResults } = this.props;
    const { showMoreResults } = this.state;

    return (
      <Row className="pt-5 justify-content-center">
        <Col small="12" className="px-0 max-width-default">
          <Alert color="warning">
            <p className="font-weight-bold">Tests without results</p>
            <p className={showMoreResults ? '' : 'text-truncate'}>
              {testsNoResults}
            </p>
            {testsNoResults.length > 174 && (
              <p
                className="mb-0 text-right font-weight-bold pointer"
                onClick={() =>
                  this.setState({ showMoreResults: !showMoreResults })
                }
              >
                {`show ${showMoreResults ? 'less' : 'more'}`}
              </p>
            )}
          </Alert>
        </Col>
      </Row>
    );
  }
}

ResultsAlert.propTypes = {
  testsNoResults: PropTypes.string.isRequired,
};
