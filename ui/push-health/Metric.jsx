import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Badge, Row, Col } from 'reactstrap';

import { resultColorMap } from './helpers';
import TestFailure from './TestFailure';

export default class Metric extends React.PureComponent {
  constructor(props) {
    super(props);

    const { result } = this.props;

    this.state = {
      detailsShowing: result !== 'pass',
    };
  }

  toggleDetails = () => {
    this.setState({ detailsShowing: !this.state.detailsShowing });
  };

  render() {
    const { detailsShowing } = this.state;
    const {
      result,
      name,
      value,
      details,
      failures,
      repo,
      revision,
    } = this.props;
    const resultColor = resultColorMap[result];
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <td>
        <Row>
          <div className={`bg-${resultColor} pr-2 mr-2`} />
          <Col>
            <Row className="justify-content-between">
              <div>
                <span className="metric-name align-top font-weight-bold">
                  {name}
                </span>
                <span onClick={this.toggleDetails} className="btn">
                  <FontAwesomeIcon icon={expandIcon} />
                </span>
              </div>
              <span>
                Confidence:
                <Badge color={resultColor} className="ml-1">
                  {value}
                </Badge>
              </span>
            </Row>
            {detailsShowing && (
              <React.Fragment>
                {failures &&
                  failures.map(failure => (
                    <TestFailure
                      key={failure.testName}
                      failure={failure}
                      repo={repo}
                      revision={revision}
                    />
                  ))}
                {details &&
                  details.map(detail => (
                    <div key={detail} className="ml-3">
                      {detail}
                    </div>
                  ))}
              </React.Fragment>
            )}
          </Col>
        </Row>
      </td>
    );
  }
}

Metric.propTypes = {
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  details: PropTypes.array.isRequired,
  failures: PropTypes.array,
};

Metric.defaultProps = {
  failures: null,
};
