import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import {
  Row,
  Collapse,
  ButtonGroup,
  ButtonDropdown,
  Button,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
} from 'reactstrap';

import JobModel from '../models/job';

import TestFailure from './TestFailure';

class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
      retriggerDropdownOpen: false,
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  toggleRetrigger = () => {
    this.setState(prevState => ({
      retriggerDropdownOpen: !prevState.retriggerDropdownOpen,
    }));
  };

  retriggerAll = times => {
    const { group, notify, currentRepo } = this.props;
    // Reduce down to the unique jobs
    const jobs = group.reduce(
      (acc, test) => ({
        ...acc,
        ...test.failJobs.reduce((fjAcc, fJob) => ({ [fJob.id]: fJob }), {}),
      }),
      {},
    );
    const uniqueJobs = Object.values(jobs);

    JobModel.retrigger(uniqueJobs, null, notify, currentRepo, times);
  };

  render() {
    const { detailsShowing, retriggerDropdownOpen } = this.state;
    const {
      group,
      name,
      repo,
      revision,
      className,
      headerColor,
      user,
      hasRetriggerAll,
      notify,
      currentRepo,
    } = this.props;
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
          {hasRetriggerAll && (
            <ButtonGroup>
              <Button
                title="Retrigger all 'Need Investigation' jobs once"
                onClick={() => this.retriggerAll(1)}
              >
                <FontAwesomeIcon
                  icon={faRedo}
                  title="Retrigger"
                  className="mr-2"
                />
                Retrigger all
              </Button>
              <ButtonDropdown
                isOpen={retriggerDropdownOpen}
                toggle={this.toggleRetrigger}
              >
                <DropdownToggle caret />
                <DropdownMenu>
                  {[5, 10, 15].map(times => (
                    <DropdownItem
                      key={times}
                      title={`Retrigger all 'Need Investigation' jobs ${times} times`}
                      onClick={() => this.retriggerAll(times)}
                    >
                      Retrigger all {times} times
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </ButtonDropdown>
            </ButtonGroup>
          )}
          <div>
            {group &&
              group.map(failure => (
                <TestFailure
                  key={failure.key}
                  failure={failure}
                  repo={repo}
                  currentRepo={currentRepo}
                  revision={revision}
                  user={user}
                  notify={notify}
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
  currentRepo: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  notify: PropTypes.func.isRequired,
  hasRetriggerAll: PropTypes.bool,
  expanded: PropTypes.bool,
  className: PropTypes.string,
  headerColor: PropTypes.string,
};

ClassificationGroup.defaultProps = {
  expanded: true,
  className: '',
  headerColor: '',
  hasRetriggerAll: false,
};

export default ClassificationGroup;
