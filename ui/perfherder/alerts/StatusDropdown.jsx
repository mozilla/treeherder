import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
} from 'reactstrap';
import moment from 'moment';
import template from 'lodash/template';
import templateSettings from 'lodash/templateSettings';

import {
  getAlertSummaryStatusText,
  getTextualSummary,
  getTitle,
  getStatus,
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
    };
  }

  fileBug = async () => {
    const { alertSummary, repoModel } = this.props;
    // TODO it seems like it'd make more sense to fetch this once and customize/cache it for future use rather than
    // fetching this template each time someone clicks on 'file bug' - regardless of test framework
    const { data, failureStatus } = await getData(
      getApiUrl(
        `/performance/bug-template/?framework=${alertSummary.framework}`,
      ),
    );
    if (!failureStatus) {
      const result = data[0];
      const templateArgs = {
        revisionHref: repoModel.getPushLogHref(alertSummary.revision),
        alertHref: `${window.location.origin}/perf.html#/alerts?id=${
          alertSummary.id
        }`,
        alertSummary: getTextualSummary(alertSummary),
      };

      templateSettings.interpolate = /{{([\s\S]+?)}}/g;
      const fillTemplate = template(result.text);
      const commentText = fillTemplate(templateArgs);

      const pushDate = moment(alertSummary.push_timestamp * 1000).format(
        'ddd MMMM D YYYY',
      );

      const bugTitle = `${getTitle(alertSummary)} regression on push ${
        alertSummary.revision
      } (${pushDate})`;

      window.open(
        `${bzBaseUrl}/enter_bug.cgi?${createQueryParams({
          cc: result.cc_list,
          comment: commentText,
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
    const { alertSummary, updateState } = this.props;
    // TODO error handling
    await update(
      getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`),
      params,
    );
    updateState({ ...alertSummary, ...params });
  };

  isResolved = alertStatus =>
    alertStatus === 'backedout' ||
    alertStatus === 'fixed' ||
    alertStatus === 'wontfix';

  isValidStatus = (alertStatus, status) =>
    alertStatus === 'investigating' ||
    (alertStatus !== status && this.isResolved(alertStatus));

  render() {
    const { alertSummary, user, issueTrackers } = this.props;
    const { showBugModal, showNotesModal } = this.state;

    const alertStatus = getStatus(alertSummary.status);

    return (
      <React.Fragment>
        {issueTrackers.length > 0 && (
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
          updateAndClose={this.updateAndClose}
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
                  <DropdownItem onClick={() => this.toggle('showBugModal')}>
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
  user: PropTypes.shape({}).isRequired,
  updateState: PropTypes.func.isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
  repoModel: PropTypes.shape({}).isRequired,
};

StatusDropdown.defaultProps = {
  issueTrackers: [],
};
