import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
} from 'reactstrap';
import moment from 'moment';

import {
  getAlertSummaryStatusText,
  getTextualSummary,
  getTitle,
} from '../helpers';
import { getData, update } from '../../helpers/http';
import { getApiUrl, bzBaseUrl, createQueryParams } from '../../helpers/url';
import { endpoints, alertSummaryStatus } from '../constants';

import BugModal from './BugModal';
import NotesModal from './NotesModal';

export default class StatusDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showBugModal: false,
      showNotesModal: false,
      issueTrackers: [],
      issueTrackersError: null,
    };
  }

  // TODO this is something else that can be moved to the parent level component
  // so it is only fetching this once per page
  getIssueTrackers = async () => {
    const { data, failureStatus } = await getData(
      getApiUrl(endpoints.issueTrackers),
    );
    this.setState(prevState => ({
      showBugModal: !prevState.showBugModal,
      issueTrackers: data,
      issueTrackersError: failureStatus,
    }));
  };

  fillTemplate = (template, replacement) => {
    let newTemplate = template;
    const regex = {
      revisionHref: /{+\srevisionHref\s}+/g,
      alertHref: /{+\salertHref\s}+/g,
      alertSummary: /{+\salertSummary\s}+/g,
    };

    for (const word of template.split(' ')) {
      if (regex[word]) {
        newTemplate = newTemplate.replace(regex[word], replacement[word]);
      }
    }
    return newTemplate;
  };

  fileBug = async () => {
    const { alertSummary, repos } = this.props;
    // TODO it seems like it'd make more sense to fetch this once and customize/cache it for future use rather than
    // fetching this template each time someone clicks on 'file bug' - regardless of test framework
    const { data, failureStatus } = await getData(
      getApiUrl(
        `/performance/bug-template/?framework=${alertSummary.framework}`,
      ),
    );
    if (!failureStatus) {
      const result = data[0];
      // repos is an instance of RepositoryModel, accessed on the $rootScope
      const repo = repos.find(repo => repo.name === alertSummary.repository);

      const templateArgs = {
        revisionHref: repo.getPushLogHref(
          alertSummary.resultSetMetadata.revision,
        ),
        alertHref: `${window.location.origin}/perf.html#/alerts?id=${
          alertSummary.id
        }`,
        alertSummary: getTextualSummary(alertSummary),
      };
      const template = this.fillTemplate(result.text, templateArgs);

      const pushDate = moment(
        alertSummary.resultSetMetadata.push_timestamp * 1000,
      ).format('ddd MMMM D YYYY');

      const bugTitle = `${getTitle(alertSummary)} regression on push ${
        alertSummary.resultSetMetadata.revision
      } (${pushDate})`;

      window.open(
        `${bzBaseUrl}/enter_bug.cgi?${createQueryParams({
          cc: result.cc_list,
          comment: template,
          component: result.default_component,
          product: result.default_product,
          keywords: result.keywords,
          short_desc: bugTitle,
          status_whiteboard: result.status_whiteboard,
        })}`,
      );
    }
  };

  copySummary = () => {
    const summary = getTextualSummary(this.props.alertSummary, true);
    // can't access the clipboardData on event unless it's done from react's
    // onCopy, onCut or onPaste props
    navigator.clipboard.writeText(summary).then(() => {});
  };

  toggle = state => {
    this.setState(prevState => ({
      [state]: !prevState[state],
    }));
  };

  updateAndClose = async (event, params, state) => {
    event.preventDefault();
    this.changeAlertSummary(params);
    this.toggle(state);
  };

  changeAlertSummary = async params => {
    const { alertSummary, updateAlertSummary } = this.props;
    // TODO error handling
    await update(
      getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`),
      params,
    );
    updateAlertSummary({ ...alertSummary, ...params });
  };

  isResolved = alertStatus =>
    alertStatus === 'backedout' ||
    alertStatus === 'fixed' ||
    alertStatus === 'wontfix';

  isValidStatus = (alertStatus, status) =>
    alertStatus === 'investigating' ||
    (alertStatus !== status && this.isResolved(alertStatus));

  render() {
    const { alertSummary, user, $rootScope } = this.props;
    const {
      showBugModal,
      issueTrackers,
      issueTrackersError,
      showNotesModal,
    } = this.state;

    const alertStatus = Object.entries(alertSummaryStatus).find(
      item => alertSummary.status === item[1],
    )[0];

    return (
      <React.Fragment>
        {!issueTrackersError && (
          <BugModal
            showModal={showBugModal}
            toggle={() => this.toggle('showBugModal')}
            issueTrackers={issueTrackers}
            alertSummary={alertSummary}
            updateAndClose={this.updateAndClose}
          />
        )}
        <NotesModal
          showModal={showNotesModal}
          toggle={() => this.toggle('showNotesModal')}
          alertSummary={alertSummary}
          $rootScope={$rootScope}
        />
        <UncontrolledDropdown tag="span">
          <DropdownToggle
            className="btn-link text-info p-0"
            color="transparent"
            caret
          >
            {getAlertSummaryStatusText(alertSummary)}
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem onClick={this.copySummary}>Copy Summary</DropdownItem>
            {!alertSummary.bug_number && (
              <DropdownItem onClick={this.fileBug}>File bug</DropdownItem>
            )}
            {user.isStaff && (
              <React.Fragment>
                {!alertSummary.bug_number ? (
                  <DropdownItem onClick={this.getIssueTrackers}>
                    Link to bug
                  </DropdownItem>
                ) : (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        bug_number: null,
                      })
                    }
                  >
                    Unlink from bug
                  </DropdownItem>
                )}
                <DropdownItem onClick={() => this.toggle('showNotesModal')}>
                  {!alertSummary.notes ? 'Add notes' : 'Edit notes'}
                </DropdownItem>
                {this.isResolved(alertStatus) && (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        status: alertSummaryStatus.investigating,
                      })
                    }
                  >
                    Re-open
                  </DropdownItem>
                )}
                {this.isValidStatus(alertStatus, 'wontfix') && (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        status: alertSummaryStatus.wontfix,
                      })
                    }
                  >
                    {"Mark as won't fix"}
                  </DropdownItem>
                )}

                {this.isValidStatus(alertStatus, 'backedout') && (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        status: alertSummaryStatus.backedout,
                      })
                    }
                  >
                    Mark as backed out
                  </DropdownItem>
                )}

                {this.isValidStatus(alertStatus, 'fixed') && (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        status: alertSummaryStatus.fixed,
                      })
                    }
                  >
                    Mark as fixed
                  </DropdownItem>
                )}
              </React.Fragment>
            )}
          </DropdownMenu>
        </UncontrolledDropdown>
      </React.Fragment>
    );
  }
}

StatusDropdown.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
  repos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
  $rootScope: PropTypes.shape({}).isRequired,
  updateAlertSummary: PropTypes.func.isRequired,
};
