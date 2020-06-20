import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  Container,
  Row,
  Col,
  Badge,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';

import { getTitle, getFrameworkName } from '../helpers';
import { getJobsUrl } from '../../helpers/url';

import Assignee from './Assignee';
import TagsList from './TagsList';

const AlertHeader = ({
  frameworks,
  alertSummary,
  repoModel,
  issueTrackers,
  user,
  updateAssignee,
}) => {
  const getIssueTrackerUrl = () => {
    const { issueTrackerUrl } = issueTrackers.find(
      (tracker) => tracker.id === alertSummary.issue_tracker,
    );
    return issueTrackerUrl + alertSummary.bug_number;
  };
  const bugNumber = alertSummary.bug_number
    ? `Bug ${alertSummary.bug_number}`
    : '';

  const performanceTags = alertSummary.performance_tags || [];

  return (
    <Container>
      <Row>
        <a
          className="text-dark"
          href={`#/alerts?id=${alertSummary.id}`}
          id={`alert summary ${alertSummary.id.toString()} title`}
          data-testid={`alert summary ${alertSummary.id.toString()} title`}
        >
          <h3 className="font-weight-bold align-middle">
            <Badge className="mr-2">
              {getFrameworkName(frameworks, alertSummary.framework)}
            </Badge>
            Alert #{alertSummary.id} - {alertSummary.repository} -{' '}
            {getTitle(alertSummary)}{' '}
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="icon-superscript"
            />
          </h3>
        </a>
      </Row>
      <Row className="font-weight-normal">
        <Col className="p-0" xs="auto">{`${moment(
          alertSummary.push_timestamp * 1000,
        ).format('ddd MMM D, HH:mm:ss')}`}</Col>
        <Col className="p-0" xs="auto">
          <UncontrolledDropdown tag="span">
            <DropdownToggle className="btn-xs ml-2" color="secondary" caret>
              {alertSummary.revision.slice(0, 12)}
            </DropdownToggle>
            <DropdownMenu>
              <DropdownItem
                tag="a"
                className="text-dark"
                href={getJobsUrl({
                  repo: alertSummary.repository,
                  fromchange: alertSummary.prev_push_revision,
                  tochange: alertSummary.revision,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Jobs
              </DropdownItem>
              <DropdownItem
                tag="a"
                className="text-dark"
                href={repoModel.getPushLogRangeHref({
                  fromchange: alertSummary.prev_push_revision,
                  tochange: alertSummary.revision,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pushlog
              </DropdownItem>
            </DropdownMenu>
          </UncontrolledDropdown>
        </Col>
        {bugNumber && (
          <Col className="p-0" xs="auto">
            {alertSummary.issue_tracker && issueTrackers.length > 0 ? (
              <a
                className="btn btn-secondary btn-xs ml-1 text-white"
                href={getIssueTrackerUrl(alertSummary)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bugNumber}
              </a>
            ) : (
              { bugNumber }
            )}
          </Col>
        )}
        <Col className="p-0" xs="auto">
          <Assignee
            assigneeUsername={alertSummary.assignee_username}
            updateAssignee={updateAssignee}
            user={user}
          />
        </Col>
      </Row>
      <Row>
        {performanceTags.length > 0 && (
          <Col className="p-0" xs="auto">
            <TagsList tags={alertSummary.performance_tags} />
          </Col>
        )}
      </Row>
    </Container>
  );
};

AlertHeader.propTypes = {
  alertSummary: PropTypes.shape({
    repository: PropTypes.string,
    framework: PropTypes.number,
    id: PropTypes.number,
    prev_push_revision: PropTypes.string,
    revision: PropTypes.string,
    push_timestamp: PropTypes.number,
    assignee_username: PropTypes.string,
    issue_tracker: PropTypes.number,
    bug_number: PropTypes.number,
    performance_tags: PropTypes.array,
  }).isRequired,
  repoModel: PropTypes.shape({
    getPushLogRangeHref: PropTypes.func,
  }).isRequired,
  user: PropTypes.shape({}).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateAssignee: PropTypes.func.isRequired,
};

AlertHeader.defaultProps = {
  issueTrackers: [],
};

export default AlertHeader;
