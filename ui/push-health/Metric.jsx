import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Badge, Row, Col, Collapse, Card, CardBody } from 'reactstrap';

import { resultColorMap } from './helpers';
import TestFailures from './TestFailures';

export default class Metric extends React.PureComponent {
  constructor(props) {
    super(props);

    const { result } = this.props;

    this.state = {
      detailsShowing: result !== 'pass',
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  render() {
    const { detailsShowing } = this.state;
    const {
      result,
      name,
      details,
      failures,
      repo,
      revision,
      user,
      notify,
      currentRepo,
    } = this.props;
    const resultColor = resultColorMap[result];
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <td>
        <Row className="flex-nowrap">
          <div className={`bg-${resultColor} pr-2 mr-2`} />
          <Col>
            <Row className="justify-content-between">
              <div onClick={this.toggleDetails} className="btn">
                <span className="metric-name align-top font-weight-bold">
                  {name}
                </span>
                <span className="btn">
                  <FontAwesomeIcon icon={expandIcon} title="expand" />
                </span>
              </div>
              <span>
                <Badge color={resultColor} className="ml-1 text-uppercase">
                  {result}
                </Badge>
              </span>
            </Row>
            <Collapse isOpen={detailsShowing}>
              <Card>
                <CardBody>
                  {name === 'Tests' && (
                    <TestFailures
                      failures={failures}
                      repo={repo}
                      currentRepo={currentRepo}
                      revision={revision}
                      user={user}
                      notify={notify}
                    />
                  )}
                  {details &&
                    details.map(detail => (
                      <div key={detail} className="ml-3">
                        {detail}
                      </div>
                    ))}
                </CardBody>
              </Card>
            </Collapse>
          </Col>
        </Row>
      </td>
    );
  }
}

Metric.propTypes = {
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  notify: PropTypes.func.isRequired,
  details: PropTypes.array,
  failures: PropTypes.object,
};

Metric.defaultProps = {
  details: null,
  failures: null,
};
