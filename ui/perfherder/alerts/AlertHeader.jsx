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

import { getIssueTrackerUrl, getTitle } from '../helpers';

const AlertHeader = ({ alertSummary }) => (
  <div className="pl-2">
    <a
      className="text-dark font-weight-bold align-middle"
      href={`#/alerts?id=${alertSummary.id}`}
    >
      Alert #{alertSummary.id} - {alertSummary.repository} -{' '}
      {getTitle(alertSummary)}{' '}
      <FontAwesomeIcon icon={faExternalLinkAlt} className="icon-superscript" />
    </a>
    <br />
    {alertSummary.resultSetMetadata && (
      <span className="font-weight-normal">
        <span className="align-middle">{`${
          alertSummary.resultSetMetadata.dateStr
        } · `}</span>
        {/* TODO replace title with a tooltip? */}
        <UncontrolledDropdown
          tag="span"
          title={alertSummary.resultSetMetadata.comments}
        >
          <DropdownToggle
            className="btn-link text-info p-0"
            color="transparent"
            caret
          >
            {alertSummary.resultSetMetadata.revision.slice(0, 12)}
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem>
              <a
                className="text-dark"
                href={alertSummary.jobsURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Jobs
              </a>
            </DropdownItem>
            <DropdownItem>
              <a
                className="text-dark"
                href={alertSummary.pushlogURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pushlog
              </a>
            </DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
        {alertSummary.bug_number && (
          <span>
            <span className="align-middle"> · </span>
            <a
              className="text-info align-middle"
              href={getIssueTrackerUrl(alertSummary)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {`Bug ${alertSummary.bug_number}`}
            </a>
          </span>
        )}
      </span>
    )}
  </div>
);

AlertHeader.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
};

export default AlertHeader;
