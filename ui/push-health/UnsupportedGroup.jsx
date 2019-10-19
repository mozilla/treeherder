/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Row, Collapse } from 'reactstrap';
import Markdown from 'react-markdown';

import UnsupportedJob from './UnsupportedJob';

const description = `
The following tasks have failed, but do not report their failures in a way that is compatible
with Push Health.

Requirements:

1. Logging must be Structured Logging using MozLog or a harness that uses MozLog.
2. Each failure must be summarized in a log file ending with \`_errorsummary.log\`.
3. The \`_errorsummary.log\` must have at least one line that has an \`action\` of \`test_result\`.
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
    const { group, name, repo, revision, className, headerColor } = this.props;
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <Row className={`justify-content-between ${className}`}>
        <h4 className="w-100" onClick={this.toggleDetails}>
          <span className={`pointable badge badge-${headerColor} w-100`}>
            {name} : {Object.keys(group).length}
            <FontAwesomeIcon
              icon={expandIcon}
              className="ml-1"
              title="expand"
            />
          </span>
        </h4>
        <Collapse isOpen={detailsShowing} className="w-100">
          <Markdown source={description} />
          <div>
            {group &&
              group.map(job => (
                <div className="card" key={job.id}>
                  <div className="card-body">
                    <UnsupportedJob
                      job={job}
                      jobName={job.job_type_name}
                      jobSymbol={job.job_type_symbol}
                      repo={repo}
                      revision={revision}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Collapse>
      </Row>
    );
  }
}

UnsupportedGroup.propTypes = {
  group: PropTypes.array.isRequired,
  name: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  className: PropTypes.string,
  headerColor: PropTypes.string,
};

UnsupportedGroup.defaultProps = {
  className: '',
  headerColor: '',
};

export default UnsupportedGroup;
