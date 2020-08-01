import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import {
  Row,
  Collapse,
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
import groupBy from 'lodash/groupBy';

import JobModel from '../models/job';

import Action from './Action';

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
    this.setState((prevState) => ({
      detailsShowing: !prevState.detailsShowing,
    }));
  };

  toggleRetrigger = () => {
    this.setState((prevState) => ({
      retriggerDropdownOpen: !prevState.retriggerDropdownOpen,
    }));
  };

  retriggerAll = (times) => {
    const { tests, notify, currentRepo, jobs } = this.props;
    // Reduce down to the unique jobs
    const testJobs = tests.reduce(
      (acc, test) => ({
        ...acc,
        ...jobs[test.jobName].reduce((fjAcc, job) => ({ [job.id]: job }), {}),
      }),
      {},
    );
    const uniqueJobs = Object.values(testJobs);

    JobModel.retrigger(uniqueJobs, currentRepo, notify, times);
  };

  setGroupedBy = (groupedBy) => {
    this.setState({ groupedBy });
  };

  setOrderedBy = (orderedBy) => {
    this.setState({ orderedBy });
  };

  getTestsByAction = (tests) => {
    const { log, crash, test } = groupBy(tests, 'action');

    return {
      'Test Failures': test || [],
      'Crashes (unknown path)': [...(log || []), ...(crash || [])],
    };
  };

  render() {
    const {
      detailsShowing,
      retriggerDropdownOpen,
      groupedBy,
      orderedBy,
    } = this.state;
    const {
      jobs,
      tests,
      name,
      revision,
      className,
      hasRetriggerAll,
      notify,
      currentRepo,
      icon,
      iconColor,
    } = this.props;
    const expandIcon = detailsShowing ? faCaretDown : faCaretRight;
    const expandTitle = detailsShowing
      ? 'Click to collapse'
      : 'Click to expand';
    const groupLength = Object.keys(tests).length;
    const testsByAction = this.getTestsByAction(tests);

    return (
      <Row
        className={`justify-content-between ${className}`}
        data-testid="classification-group"
      >
        <span className="font-size-24">
          <FontAwesomeIcon
            icon={expandIcon}
            className="mr-1 min-width-1"
            title={expandTitle}
            aria-label={expandTitle}
            alt=""
          />
          <Button
            onClick={this.toggleDetails}
            outline
            className="font-size-24 border-0"
            role="button"
            aria-expanded={detailsShowing}
          >
            <FontAwesomeIcon icon={icon} className={`mr-2 text-${iconColor}`} />
            {name} ({groupLength})
          </Button>
        </span>
        {hasRetriggerAll && groupLength > 0 && detailsShowing && (
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
                      alt=""
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
                      {[5, 10, 15].map((times) => (
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
                    outline
                    data-testid="groupTestsDropdown"
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
                    outline
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
        <Collapse isOpen={detailsShowing} className="w-100">
          {Object.entries(testsByAction).map(([key, value]) => (
            <Action
              name={key}
              tests={value}
              groupedBy={groupedBy}
              orderedBy={orderedBy}
              revision={revision}
              currentRepo={currentRepo}
              notify={notify}
              key={key}
              jobs={jobs}
            />
          ))}
        </Collapse>
      </Row>
    );
  }
}

ClassificationGroup.propTypes = {
  tests: PropTypes.arrayOf(PropTypes.object).isRequired,
  name: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  hasRetriggerAll: PropTypes.bool,
  expanded: PropTypes.bool,
  className: PropTypes.string,
  iconColor: PropTypes.string,
};

ClassificationGroup.defaultProps = {
  expanded: true,
  className: '',
  iconColor: 'darker-info',
  hasRetriggerAll: false,
};

export default ClassificationGroup;
