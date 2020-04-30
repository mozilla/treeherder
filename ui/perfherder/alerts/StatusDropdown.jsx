import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  Col,
  Label,
} from 'reactstrap';
import moment from 'moment';
import template from 'lodash/template';
import templateSettings from 'lodash/templateSettings';

import {
  getFrameworkName,
  getTextualSummary,
  getTitle,
  getStatus,
  updateAlertSummary,
} from '../helpers';
import { getData } from '../../helpers/http';
import { getApiUrl, bzBaseUrl, createQueryParams } from '../../helpers/url';
import { summaryStatusMap } from '../constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';

import AlertModal from './AlertModal';
import NotesModal from './NotesModal';

export default class StatusDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showBugModal: false,
      showNotesModal: false,
      selectedValue: this.props.issueTrackers[0].text,
    };
  }

  fileBug = async () => {
    const {
      alertSummary,
      repoModel,
      bugTemplate,
      updateViewState,
      filteredAlerts,
      frameworks,
    } = this.props;
    let result = bugTemplate;

    if (!result) {
      const { data, failureStatus } = await getData(
        getApiUrl(
          `/performance/bug-template/?framework=${alertSummary.framework}`,
        ),
      );
      if (failureStatus) {
        updateViewState({
          errorMessages: [`Failed to retrieve bug template: ${data}`],
        });
      } else {
        [result] = data;
        updateViewState({ bugTemplate: result });
      }
    }

    const templateArgs = {
      framework: getFrameworkName(frameworks, alertSummary.framework),
      revision: alertSummary.revision,
      revisionHref: repoModel.getPushLogHref(alertSummary.revision),
      alertHref: `${window.location.origin}/perf.html#/alerts?id=${alertSummary.id}`,
      alertSummary: getTextualSummary(filteredAlerts, alertSummary),
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
      `${bzBaseUrl}/enter_bug.cgi${createQueryParams({
        cc: result.cc_list,
        comment: commentText,
        component: result.default_component,
        product: result.default_product,
        keywords: result.keywords,
        short_desc: bugTitle,
        status_whiteboard: result.status_whiteboard,
      })}`,
    );
  };

  copySummary = () => {
    const { filteredAlerts, alertSummary } = this.props;
    const summary = getTextualSummary(filteredAlerts, alertSummary, true);
    // can't access the clipboardData on event unless it's done from react's
    // onCopy, onCut or onPaste props so using this workaround
    navigator.clipboard.writeText(summary).then(() => {});
  };

  toggle = (state) => {
    this.setState((prevState) => ({
      [state]: !prevState[state],
    }));
  };

  updateAndClose = async (event, params, state) => {
    event.preventDefault();
    this.changeAlertSummary(params);
    this.toggle(state);
  };

  changeAlertSummary = async (params) => {
    const { alertSummary, updateState, updateViewState } = this.props;

    const { data, failureStatus } = await updateAlertSummary(
      alertSummary.id,
      params,
    );

    if (failureStatus) {
      return updateViewState({
        errorMessages: [
          `Failed to update alert summary ${alertSummary.id}: ${data}`,
        ],
      });
    }
    updateState({ alertSummary: data });
  };

  isResolved = (alertStatus) =>
    alertStatus === 'backedout' ||
    alertStatus === 'fixed' ||
    alertStatus === 'wontfix';

  isValidStatus = (alertStatus, status) =>
    alertStatus === 'investigating' ||
    (alertStatus !== status && this.isResolved(alertStatus));

  render() {
    const { alertSummary, user, issueTrackers } = this.props;
    const { showBugModal, showNotesModal, selectedValue } = this.state;

    const alertStatus = getStatus(alertSummary.status);

    return (
      <React.Fragment>
        {issueTrackers.length > 0 && (
          <AlertModal
            showModal={showBugModal}
            toggle={() => this.toggle('showBugModal')}
            updateAndClose={(event, inputValue) =>
              this.updateAndClose(
                event,
                {
                  bug_number: parseInt(inputValue, 10),
                  issue_tracker: issueTrackers.find(
                    (item) => item.text === selectedValue,
                  ).id,
                },
                'showBugModal',
              )
            }
            header="Link to Bug"
            title="Bug Number"
            dropdownOption={
              <Col>
                <Label for="issueTrackerSelector">Select Bug Tracker</Label>
                <UncontrolledDropdown>
                  <DropdownToggle caret outline>
                    {selectedValue}
                  </DropdownToggle>
                  <DropdownMenuItems
                    updateData={(selectedValue) =>
                      this.setState({ selectedValue })
                    }
                    selectedItem={selectedValue}
                    options={issueTrackers.map((item) => item.text)}
                  />
                </UncontrolledDropdown>
              </Col>
            }
          />
        )}
        <NotesModal
          showModal={showNotesModal}
          toggle={() => this.toggle('showNotesModal')}
          alertSummary={alertSummary}
          updateAndClose={this.updateAndClose}
        />
        <UncontrolledDropdown tag="span">
          <DropdownToggle className="btn-xs" color="darker-secondary" caret>
            {getStatus(alertSummary.status)}
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem tag="a" onClick={this.copySummary}>
              Copy Summary
            </DropdownItem>
            {!alertSummary.bug_number && (
              <DropdownItem tag="a" onClick={this.fileBug}>
                File bug
              </DropdownItem>
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
                        status: summaryStatusMap.investigating,
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
                        status: summaryStatusMap.wontfix,
                      })
                    }
                  >
                    Mark as won&apos;t fix
                  </DropdownItem>
                )}

                {this.isValidStatus(alertStatus, 'backedout') && (
                  <DropdownItem
                    onClick={() =>
                      this.changeAlertSummary({
                        status: summaryStatusMap.backedout,
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
                        status: summaryStatusMap.fixed,
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
  issueTrackers: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
    }),
  ),
  repoModel: PropTypes.shape({}).isRequired,
  updateViewState: PropTypes.func.isRequired,
  bugTemplate: PropTypes.shape({}),
  filteredAlerts: PropTypes.arrayOf(PropTypes.shape({})),
};

StatusDropdown.defaultProps = {
  issueTrackers: [],
  bugTemplate: null,
  filteredAlerts: [],
};
