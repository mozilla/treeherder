import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';

import { getTitle } from '../helpers';
import { getJobsUrl } from '../../helpers/url';

// TODO refactor getIssueTracker URL - issue trackers being fetched in Alerts View
const AlertHeader = ({ alertSummary, repoModel, issueTrackers }) => {
  const getIssueTrackerUrl = () => {
    const { issueTrackerUrl } = issueTrackers.find(
      tracker => tracker.id === alertSummary.issue_tracker,
    );
    return issueTrackerUrl + alertSummary.bug_number;
  };
  const bugNumber = alertSummary.bug_number
    ? `Bug ${alertSummary.bug_number}`
    : '';

  return (
    <div className="pl-2">
      <a
        className="text-dark font-weight-bold align-middle"
        href={`#/alerts?id=${alertSummary.id}`}
      >
        Alert #{alertSummary.id} - {alertSummary.repository} -{' '}
        {getTitle(alertSummary)}{' '}
        <FontAwesomeIcon
          icon={faExternalLinkAlt}
          className="icon-superscript"
        />
      </a>
      <br />
      <span className="font-weight-normal">
        <span className="align-middle">{`${moment(
          alertSummary.push_timestamp * 1000,
        ).format('ddd MMM d, HH:mm:ss')} · `}</span>
        <UncontrolledDropdown tag="span">
          <DropdownToggle
            className="btn-link text-info p-0"
            color="transparent"
            caret
          >
            {alertSummary.revision.slice(0, 12)}
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem>
              <a
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
              </a>
            </DropdownItem>
            <DropdownItem>
              <a
                className="text-dark"
                href={repoModel.getPushLogRangeHref({
                  fromchange: alertSummary.prev_push_revision,
                  tochange: alertSummary.revision,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pushlog
              </a>
            </DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
        {bugNumber && (
          <span>
            <span className="align-middle"> · </span>
            {alertSummary.issue_tracker && issueTrackers.length > 0 ? (
              <a
                className="text-info align-middle"
                href={getIssueTrackerUrl(alertSummary)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bugNumber}
              </a>
            ) : (
              { bugNumber }
            )}
          </span>
        )}
      </span>
    </div>
  );
};

AlertHeader.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
  repoModel: PropTypes.shape({}).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
};

AlertHeader.defaultProps = {
  issueTrackers: [],
};

export default AlertHeader;
