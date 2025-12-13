import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Dropdown,
  Container,
  Row,
  Col,
  Button,
  Form,
  InputGroup,
} from 'react-bootstrap';

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
  issueTrackers = [],
  user,
  updateAssignee,
  changeRevision,
  updateViewState,
}) => {
  const [inEditMode, setInEditMode] = useState(false);
  const [newRevisionTo, setnewRevisionTo] = useState(alertSummary.revision);
  const [newRevisionFrom, setnewRevisionFrom] = useState(
    alertSummary.prev_push_revision,
  );
  const revisionToType = 'to';

  const handleEditMode = () => {
    setnewRevisionTo('');
    setnewRevisionFrom('');
    setInEditMode(true);
  };
  const handleRevisionChange = (revisionType) => (event) => {
    // revisionType can only be "to" or "from"
    if (revisionType === revisionToType) setnewRevisionTo(event.target.value);
    else setnewRevisionFrom(event.target.value);
  };
  const saveRevision = async () => {
    const trimmedRevisionTo =
      newRevisionTo.trim() === ''
        ? alertSummary.revision
        : newRevisionTo.trim();
    const trimmedRevisionFrom =
      newRevisionFrom.trim() === ''
        ? alertSummary.prev_push_revision
        : newRevisionFrom.trim();

    const longHashMatch = /\b[a-f0-9]{40}\b/;
    if (
      !longHashMatch.test(trimmedRevisionTo) ||
      !longHashMatch.test(trimmedRevisionFrom)
    ) {
      updateViewState({
        errorMessages: [
          `Invalid Revision format, expected a 40 character hash.`,
        ],
      });
      return;
    }
    const response = await changeRevision(
      trimmedRevisionTo,
      trimmedRevisionFrom,
    );
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
  const handleRevertRevision = (revisionType) => () => {
    // revisionType can only be "to" or "from"
    if (revisionType === revisionToType)
      setnewRevisionTo(alertSummary.original_revision);
    else setnewRevisionFrom(alertSummary.original_prev_push_revision);
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
      <Row className="font-weight-normal gap-2">
        <Col className="p-0 pe-1" xs="auto">
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
        </Col>
        {user.isStaff && (
          <Col className="p-0" xs="auto">
            <Button
              variant="darker-secondary"
              size="xs"
              onClick={handleEditMode}
              title="Click to edit revision"
            >
              Edit Revisions
            </Button>
          </Col>
        )}
        <Col className="p-0" xs="auto">
          <Dropdown tag="span">
            <Dropdown.Toggle
              className="btn-xs"
              variant="secondary"
              data-testid="push-dropdown"
            >
              {formattedSummaryRevision}
            </Dropdown.Toggle>
            <Dropdown.Menu className="overflow-auto dropdown-menu-height">
              <Dropdown.Item
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
              </Dropdown.Item>
              <Dropdown.Item
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
              </Dropdown.Item>
              <Dropdown.Item
                className="text-dark"
                disabled
                data-testid="prev-push-revision"
              >
                From: {`${alertSummary.prev_push_revision.slice(0, 12)}`}
              </Dropdown.Item>
              <Dropdown.Item
                className="text-dark"
                disabled
                data-testid="to-push-revision"
              >
                To: {formattedSummaryRevision}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        {bugNumber && (
          <Col className="p-0" xs="auto">
            {alertSummary.issue_tracker && issueTrackers.length > 0 ? (
              <a
                className="btn btn-secondary btn-xs text-white"
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
      <Row className="px-0 py-2">
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
        {(alertSummary.original_revision !== alertSummary.revision ||
          alertSummary.original_prev_push_revision !==
            alertSummary.prev_push_revision) && (
          <span className="px-2">Revisions have been modified.</span>
        )}
      </Row>
      {alertSummary.duplicated_summaries_ids.length > 0 && (
        <Row>
          Duplicated summaries:
          {alertSummary.duplicated_summaries_ids.map((id, index) => (
            <Link
              className="text-dark me-1"
              target="_blank"
              to={`./alerts?id=${id}&hideDwnToInv=0`}
              id={`duplicated alert summary ${id.toString()} `}
              style={{ marginLeft: '5px' }}
            >
              Alert #{id}
              {alertSummary.duplicated_summaries_ids.length - 1 !== index &&
                ', '}
            </Link>
          ))}
        </Row>
      )}
      <Row>
        {performanceTags.length > 0 && (
          <Col className="p-0" xs="auto">
            <TagsList tags={alertSummary.performance_tags} />
          </Col>
        )}
      </Row>
      {inEditMode && (
        <div>
          <Row className="mb-2">
            <Col xs="2" className="p-0 align-content-center">
              <span className="align-middle">Current From: </span>
            </Col>
            <Col xs="2" className="p-0 align-content-center">
              <span className="align-middle">
                {`${alertSummary.prev_push_revision.slice(0, 12)}`}{' '}
              </span>
            </Col>

            <Col xs="5" className="p-0">
              <InputGroup size="sm">
                <Form.Control
                  value={newRevisionFrom}
                  placeholder="Enter desired revision"
                  onChange={handleRevisionChange('from')}
                  autoFocus
                />
              </InputGroup>
            </Col>
            <Col xs="3" className="p-0">
              <Button
                className="ms-1"
                size="sm"
                disabled={
                  alertSummary.original_prev_push_revision ===
                  alertSummary.prev_push_revision
                }
                onClick={handleRevertRevision('from')}
              >
                Reset Revision
              </Button>
            </Col>
          </Row>
          <Row className="mb-2">
            <Col xs="2" className="p-0 align-content-center">
              <span className="align-middle">Current To: </span>
            </Col>
            <Col xs="2" className="p-0 align-content-center">
              <span className="align-middle">{formattedSummaryRevision} </span>
            </Col>
            <Col xs="5" className="p-0">
              <InputGroup size="sm">
                <Form.Control
                  value={newRevisionTo}
                  placeholder="Enter desired revision"
                  onChange={handleRevisionChange('to')}
                  autoFocus
                />
              </InputGroup>
            </Col>
            <Col xs="3" className="p-0">
              <Button
                className="ms-1"
                size="sm"
                disabled={
                  alertSummary.original_revision === alertSummary.revision
                }
                onClick={handleRevertRevision('to')}
              >
                Reset Revision
              </Button>
            </Col>
          </Row>
          <Row>
            <Col className="p-0">
              <Button
                variant="primary"
                className="ms-1"
                size="xs"
                disabled={newRevisionTo === '' && newRevisionFrom === ''}
                onClick={saveRevision}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                className="ms-1"
                size="xs"
                onClick={cancelEditMode}
              >
                Cancel
              </Button>
            </Col>
          </Row>
        </div>
      )}
    </Container>
  );
};

AlertHeader.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
  repoModel: PropTypes.shape({}).isRequired,
  user: PropTypes.shape({}).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
};

export default AlertHeader;
