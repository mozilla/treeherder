import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Badge, Card, CardBody, Row, Collapse } from 'reactstrap';
import Markdown from 'react-markdown';

import UnsupportedJob from './UnsupportedJob';

const description = `
The following tasks have failed, but do not report their failures in a way that is compatible
with Push Health.

Requirements:

1. Logging must be Structured Logging using MozLog or a harness that uses MozLog.
2. Each failure must be summarized in a log file ending with \`_errorsummary.log\`.
3. The \`*_errorsummary.log\` must have at least one line that has an \`action\` of \`test_result\`.
`;

class UnsupportedGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: false,
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  render() {
    const { detailsShowing } = this.state;
    const {
      group,
      name,
      revision,
      className,
      headerColor,
      currentRepo,
    } = this.props;
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <Row className={`justify-content-between ${className}`}>
        <h4 className="w-100">
          <Badge
            className="pointable w-100"
            color={headerColor}
            onClick={this.toggleDetails}
          >
            {name} : {Object.keys(group).length}
            <FontAwesomeIcon
              icon={expandIcon}
              className="ml-1"
              title="expand"
              alt=""
            />
          </Badge>
        </h4>
        <Collapse isOpen={detailsShowing} className="w-100">
          <Markdown source={description} />
          <div>
            {group &&
              group.map(job => (
                <Card key={job.id}>
                  <CardBody>
                    <UnsupportedJob
                      job={job}
                      jobName={job.job_type_name}
                      jobSymbol={job.job_type_symbol}
                      revision={revision}
                      currentRepo={currentRepo}
                    />
                  </CardBody>
                </Card>
              ))}
          </div>
        </Collapse>
      </Row>
    );
  }
}

UnsupportedGroup.propTypes = {
  group: PropTypes.arrayOf(PropTypes.object).isRequired,
  name: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  className: PropTypes.string,
  headerColor: PropTypes.string,
  currentRepo: PropTypes.shape({}).isRequired,
};

UnsupportedGroup.defaultProps = {
  className: '',
  headerColor: '',
};

export default UnsupportedGroup;
