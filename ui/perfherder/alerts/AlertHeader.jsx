import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  Container,
  Row,
  Col,
  Button,
  Input,
  InputGroup,
} from 'reactstrap';

import { getJobsUrl, getPerfCompareBaseURL } from '../../helpers/url';
import { toMercurialShortDateStr } from '../../helpers/display';
import SimpleTooltip from '../../shared/SimpleTooltip';

import Assignee from './Assignee';
import TagsList from './TagsList';
import AlertHeaderTitle from './AlertHeaderTitle';

const AlertHeader = ({
  frameworks,
  alertSummary,
  repoModel,
  issueTrackers,
  user,
  updateAssignee,
  changeRevision,
  updateViewState,
}) => {
  const [inEditMode, setInEditMode] = useState(false);
  const [newRevision, setNewRevision] = useState(alertSummary.revision);

  const handleEditMode = () => {
    setNewRevision('');
    setInEditMode(true);
  };
  const handleRevisionChange = (event) => {
    setNewRevision(event.target.value);
  };
  const saveRevision = async () => {
    const longHashMatch = /\b[a-f0-9]{40}\b/;
    const trimmedRevision = newRevision.trim();
    if (!longHashMatch.test(trimmedRevision)) {
      updateViewState({
        errorMessages: [
          `Invalid Revision format, expected a 40 character hash.`,
        ],
      });
      return;
    }
    const response = await changeRevision(trimmedRevision);
    if (!response.failureStatus) {
      setInEditMode(false);
    }
  };
  const cancelEditMode = () => {
    setInEditMode(false);
  };
  const getIssueTrackerUrl = () => {
    const { issue_tracker_url: issueTrackerUrl } = issueTrackers.find(
      (tracker) => tracker.id === alertSummary.issue_tracker,
    );
    return issueTrackerUrl + alertSummary.bug_number;
  };
  const handleRevertRevision = async () => {
    await changeRevision(alertSummary.original_revision);
  };
  const bugNumber = alertSummary.bug_number
    ? `Bug ${alertSummary.bug_number}`
    : '';

  const performanceTags = alertSummary.performance_tags || [];
  const alertSummaryDatetime = new Date(alertSummary.push_timestamp * 1000);
  const formattedSummaryRevision = alertSummary.revision.slice(0, 12);
  const created = new Date(alertSummary.created.slice(0, 19));

  return (
    <Container>
      <AlertHeaderTitle alertSummary={alertSummary} frameworks={frameworks} />
      <Row className="font-weight-normal">
        <Col className="p-0" xs="auto">
          <Row className="m-0 px-0 py-0">
            <SimpleTooltip
              text={toMercurialShortDateStr(alertSummaryDatetime)}
              tooltipText="Push date"
            />
          </Row>
          <Row className="m-0 px-0 py-0">
            <SimpleTooltip
              text={toMercurialShortDateStr(created)}
              tooltipText="Alert Summary created"
            />
          </Row>
          <Row className="m-0 px-0 py-0">
            <a
              href={getPerfCompareBaseURL(
                alertSummary.repository,
                alertSummary.prev_push_revision,
                alertSummary.repository,
                alertSummary.revision,
                alertSummary.framework,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              PerfCompare comparison
            </a>
          </Row>
        </Col>
        <Col className="p-0" xs="auto">
          {inEditMode ? (
            <InputGroup size="sm">
              <Input
                placeholder="Enter desired revision"
                onChange={handleRevisionChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveRevision();
                  }
                  if (event.key === 'Escape') cancelEditMode();
                }}
                autoFocus
              />
              <Button
                color="primary"
                className="ml-1"
                size="xs"
                onClick={saveRevision}
              >
                Save
              </Button>
              <Button
                color="secondary"
                className="ml-1"
                size="xs"
                onClick={cancelEditMode}
              >
                Cancel
              </Button>
            </InputGroup>
          ) : (
            <Button
              className="ml-1"
              color="darker-secondary"
              size="xs"
              onClick={handleEditMode}
              title="Click to edit revision"
            >
              Edit Revision
            </Button>
          )}
        </Col>
        {user.isStaff &&
          alertSummary.original_revision !== alertSummary.revision && (
            <Col className="p-0" xs="auto">
              <Button className="ml-1" size="xs" onClick={handleRevertRevision}>
                Reset Revision
              </Button>
            </Col>
          )}
        <Col className="p-0" xs="auto">
          <UncontrolledDropdown tag="span">
            <DropdownToggle
              className="btn-xs ml-1"
              color="secondary"
              caret
              data-testid="push-dropdown"
            >
              {formattedSummaryRevision}
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
              <DropdownItem
                className="text-dark"
                disabled
                data-testid="prev-push-revision"
              >
                From: {`${alertSummary.prev_push_revision.slice(0, 12)}`}
              </DropdownItem>
              <DropdownItem
                className="text-dark"
                disabled
                data-testid="to-push-revision"
              >
                To: {formattedSummaryRevision}
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
  alertSummary: PropTypes.shape({}).isRequired,
  repoModel: PropTypes.shape({}).isRequired,
  user: PropTypes.shape({}).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
};

AlertHeader.defaultProps = {
  issueTrackers: [],
};

export default AlertHeader;
