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
  Badge,
  ButtonGroup,
  ButtonDropdown,
  Button,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
  Navbar,
  Nav,
  NavItem,
  UncontrolledButtonDropdown,
} from 'reactstrap';

import JobModel from '../models/job';

import './pushhealth.css';
import GroupedTests from './GroupedTests';

class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
      retriggerDropdownOpen: false,
      groupedBy: 'path',
      orderedBy: 'count',
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

    JobModel.retrigger(uniqueJobs, currentRepo, notify, times);
  };

  setGroupedBy = groupedBy => {
    this.setState({ groupedBy });
  };

  setOrderedBy = orderedBy => {
    this.setState({ orderedBy });
  };

  render() {
    const {
      detailsShowing,
      retriggerDropdownOpen,
      groupedBy,
      orderedBy,
    } = this.state;
    const {
      group,
      name,
      repo,
      revision,
      className,
      headerColor,
      hasRetriggerAll,
      notify,
      currentRepo,
      unfilteredLength,
    } = this.props;
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;
    const expandTitle = detailsShowing
      ? 'Click to collapse'
      : 'Click to expand';
    const groupLength = Object.keys(group).length;
    return (
      <Row
        className={`justify-content-between ${className}`}
        data-testid="classification-group"
      >
        <h4 className="w-100">
          <Badge
            className="pointable w-100"
            onClick={this.toggleDetails}
            color={headerColor}
            role="button"
            aria-expanded={detailsShowing}
          >
            {name} : {groupLength}{' '}
            {unfilteredLength > groupLength &&
              `(${unfilteredLength} unfiltered)`}
            <FontAwesomeIcon
              icon={expandIcon}
              className="ml-1"
              title={expandTitle}
              aria-label={expandTitle}
            />
          </Badge>
        </h4>
        <Collapse isOpen={detailsShowing} className="w-100">
          {hasRetriggerAll && groupLength > 0 && (
            <Navbar className="mb-4">
              <Nav>
                <NavItem>
                  <ButtonGroup size="sm">
                    <Button
                      title="Retrigger all 'Need Investigation' jobs once"
                      onClick={() => this.retriggerAll(1)}
                      size="sm"
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
                      size="sm"
                    >
                      <DropdownToggle caret />
                      <DropdownMenu>
                        {[5, 10, 15].map(times => (
                          <DropdownItem
                            key={times}
                            title={`Retrigger all 'Need Investigation' jobs ${times} times`}
                            onClick={() => this.retriggerAll(times)}
                            className="pointable"
                            tag="a"
                          >
                            Retrigger all {times} times
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </ButtonDropdown>
                  </ButtonGroup>
                </NavItem>
                <NavItem>
                  <UncontrolledButtonDropdown size="sm" className="ml-1">
                    <DropdownToggle
                      className="btn-sm ml-1 text-capitalize"
                      id="groupTestsDropdown"
                      caret
                    >
                      Group By: {groupedBy}
                    </DropdownToggle>
                    <DropdownMenu toggler="groupTestsDropdown">
                      <DropdownItem
                        className="pointable"
                        tag="a"
                        onClick={() => this.setGroupedBy('none')}
                      >
                        None
                      </DropdownItem>
                      <DropdownItem
                        className="pointable"
                        tag="a"
                        onClick={() => this.setGroupedBy('path')}
                      >
                        Path
                      </DropdownItem>
                      <DropdownItem
                        className="pointable"
                        tag="a"
                        onClick={() => this.setGroupedBy('platform')}
                      >
                        Platform
                      </DropdownItem>
                    </DropdownMenu>
                  </UncontrolledButtonDropdown>
                </NavItem>
                <NavItem>
                  <UncontrolledButtonDropdown size="sm" className="ml-1">
                    <DropdownToggle
                      className="btn-sm ml-1 text-capitalize"
                      id="groupTestsDropdown"
                      caret
                    >
                      Order By: {orderedBy}
                    </DropdownToggle>
                    <DropdownMenu toggler="groupTestsDropdown">
                      <DropdownItem
                        className="pointable"
                        tag="a"
                        onClick={() => this.setOrderedBy('count')}
                      >
                        Count
                      </DropdownItem>
                      <DropdownItem
                        className="pointable"
                        tag="a"
                        onClick={() => this.setOrderedBy('text')}
                      >
                        Text
                      </DropdownItem>
                    </DropdownMenu>
                  </UncontrolledButtonDropdown>
                </NavItem>
              </Nav>
            </Navbar>
          )}
          <div>
            <GroupedTests
              group={group}
              repo={repo}
              revision={revision}
              groupedBy={groupedBy}
              orderedBy={orderedBy}
              currentRepo={currentRepo}
              notify={notify}
            />
          </div>
        </Collapse>
      </Row>
    );
  }
}

ClassificationGroup.propTypes = {
  group: PropTypes.arrayOf(PropTypes.object).isRequired,
  name: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  unfilteredLength: PropTypes.number.isRequired,
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
