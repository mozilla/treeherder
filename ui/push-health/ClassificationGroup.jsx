import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Row, Collapse } from 'reactstrap';

import TestFailure from './TestFailure';

export default class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
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
      repo,
      revision,
      className,
      headerColor,
      user,
    } = this.props;
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <Row className={`justify-content-between ${className}`}>
        <h4 className="w-100" onClick={this.toggleDetails}>
          <span className={`pointable badge badge-${headerColor} w-100`}>
            {name} : {Object.keys(group).length}
            <FontAwesomeIcon icon={expandIcon} className="ml-1" />
          </span>
        </h4>
        <Collapse isOpen={detailsShowing} className="w-100">
          <div>
            {group &&
              group.map(failure => (
                <TestFailure
                  key={failure.key}
                  failure={failure}
                  repo={repo}
                  revision={revision}
                  user={user}
                />
              ))}
          </div>
        </Collapse>
      </Row>
    );
  }
}

ClassificationGroup.propTypes = {
  group: PropTypes.array.isRequired,
  name: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  expanded: PropTypes.bool,
  className: PropTypes.string,
  headerColor: PropTypes.string,
};

ClassificationGroup.defaultProps = {
  expanded: true,
  className: '',
  headerColor: '',
};
