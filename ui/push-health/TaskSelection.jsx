import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Form } from 'react-bootstrap';

class TaskSelection extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      isTestSelected: false,
    };
  }

  componentDidUpdate(prevProps) {
    const { allPlatformsSelected } = this.props;
    const { isTestSelected } = this.props;

    if (
      prevProps.allPlatformsSelected !== allPlatformsSelected &&
      allPlatformsSelected !== isTestSelected
    ) {
      this.setState({ isTestSelected: allPlatformsSelected });
    }
  }

  selectTest = (e) => {
    const { addSelectedTest, removeSelectedTest, failure } = this.props;

    if (e.target.checked) addSelectedTest(failure);
    else removeSelectedTest(failure);
    this.setState((prevState) => ({
      isTestSelected: !prevState.isTestSelected,
    }));
  };

  render() {
    const { failure, groupedBy } = this.props;
    const { testName, jobName, key, tier, isInvestigated } = failure;
    const { isTestSelected } = this.state;

    return (
      <React.Fragment>
        <Col xs="auto">
          <Form.Check
            type="checkbox"
            checked={isTestSelected}
            onChange={this.selectTest}
            aria-label={`Select ${jobName}`}
            id={`checkbox-${key}`}
          />
        </Col>
        <Col>
          <Row>
            <span
              id={key}
              className={`px-2 text-darker-secondary font-weight-500 ${
                isInvestigated && 'investigated'
              }`}
            >
              <span>{groupedBy !== 'path' && `${testName} `}</span>
              <span>{jobName}</span>
              {tier > 1 && (
                <span className="ml-1 small text-muted">[tier-{tier}]</span>
              )}
            </span>
          </Row>
        </Col>
      </React.Fragment>
    );
  }
}

TaskSelection.propTypes = {
  failure: PropTypes.shape({
    testName: PropTypes.string.isRequired,
    jobName: PropTypes.string.isRequired,
    jobSymbol: PropTypes.string.isRequired,
    confidence: PropTypes.number.isRequired,
    platform: PropTypes.string.isRequired,
    config: PropTypes.string.isRequired,
    suggestedClassification: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
  }).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  groupedBy: PropTypes.string.isRequired,
};

export default TaskSelection;
