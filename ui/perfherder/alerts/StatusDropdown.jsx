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
import template from 'lodash/template';
import templateSettings from 'lodash/templateSettings';

import {
  getFrameworkName,
  getFilledBugSummary,
  getStatus,
  updateAlertSummary,
} from '../perf-helpers/helpers';
import { getData } from '../../helpers/http';
import TextualSummary from '../perf-helpers/textualSummary';
import {
  getApiUrl,
  bzBaseUrl,
  createQueryParams,
  bugzillaBugsApi,
} from '../../helpers/url';
import { summaryStatusMap, weekdays } from '../perf-helpers/constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';
import BrowsertimeAlertsExtraData from '../../models/browsertimeAlertsExtraData';

import AlertModal from './AlertModal';
import FileBugModal from './FileBugModal';
import NotesModal from './NotesModal';
import TagsModal from './TagsModal';
import AlertStatusCountdown from './AlertStatusCountdown';
import { isWeekend } from '../perf-helpers/alertCountdownHelper';

export default class StatusDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showBugModal: false,
      showFileBugModal: false,
      showNotesModal: false,
      showTagsModal: false,
      selectedValue: this.props.issueTrackers[0].text,
      browsertimeAlertsExtraData: new BrowsertimeAlertsExtraData(
        this.props.alertSummary,
        this.props.frameworks,
      ),
      isWeekend: isWeekend(),
    };
  }

  getCulpritDetails = async (culpritId) => {
    const bugDetails = await getData(bugzillaBugsApi(`bug/${culpritId}`));
    if (bugDetails.failureStatus) {
      return bugDetails;
    }
    const bugData = bugDetails.data.bugs[0];

    const bugVersion = 'Default';
    const needinfoFrom = bugData.assigned_to;
    // Using set because it doesn't keep duplicates by default
    const ccList = new Set();
    ccList.add(bugData.creator);

    return {
      bug_version: bugVersion,
      needinfoFrom,
      ccList,
      component: bugData.component,
      product: bugData.product,
    };
  };

  fileBug = async (culpritId) => {
    const {
      alertSummary,
      repoModel,
      bugTemplate,
      updateViewState,
      filteredAlerts,
      frameworks,
    } = this.props;
    const { browsertimeAlertsExtraData } = this.state;
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
    const textualSummary = new TextualSummary(
      frameworks,
      filteredAlerts,
      alertSummary,
      null,
      await browsertimeAlertsExtraData.enrichAndRetrieveAlerts(),
    );
    const templateArgs = {
      bugType: 'defect',
      framework: getFrameworkName(frameworks, alertSummary.framework),
      revision: alertSummary.revision,
      revisionHref: repoModel.getPushLogHref(alertSummary.revision),
      alertHref: `${window.location.origin}/perfherder/alerts?id=${alertSummary.id}`,
      alertSummary: textualSummary.markdown,
    };

    templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    const fillTemplate = template(result.text);
    const commentText = fillTemplate(templateArgs);

    const bugTitle = `${getFilledBugSummary(alertSummary)}`;

    const culpritDetails = await this.getCulpritDetails(culpritId);
    const defaultParams = {
      bug_type: templateArgs.bugType,
      version: 'unspecified',
      // result.cc_list is a string, not array
      cc: result.cc_list,
      comment: commentText,
      component: result.default_component,
      product: result.default_product,
      keywords: result.keywords,
      short_desc: bugTitle,
      status_whiteboard: result.status_whiteboard,
    };

    if (culpritDetails.failureStatus) {
      window.open(
        `${bzBaseUrl}enter_bug.cgi${createQueryParams(defaultParams)}`,
      );
    } else {
      let cc = culpritDetails.ccList.add(result.cc_list);
      cc = Array.from(cc);
      window.open(
        `${bzBaseUrl}enter_bug.cgi${createQueryParams({
          ...defaultParams,
          cc,
          needinfo_from: culpritDetails.needinfoFrom,
          component: culpritDetails.component,
          product: culpritDetails.product,
          regressed_by: culpritId,
          cf_has_regression_range: 'yes',
        })}`,
      );
    }
  };

  copySummary = async () => {
    const { filteredAlerts, alertSummary, frameworks } = this.props;
    const { browsertimeAlertsExtraData } = this.state;
    const textualSummary = new TextualSummary(
      frameworks,
      filteredAlerts,
      alertSummary,
      true,
      await browsertimeAlertsExtraData.enrichAndRetrieveAlerts(),
    );
    // can't access the clipboardData on event unless it's done from react's
    // onCopy, onCut or onPaste props so using this workaround
    navigator.clipboard.writeText(textualSummary.markdown).then(() => {});
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

  fileBugAndClose = async (event, params, state) => {
    event.preventDefault();
    const culpritId = params.bug_number;
    await this.fileBug(culpritId);
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
    const { alertSummary, user, issueTrackers, performanceTags } = this.props;
    const {
      showBugModal,
      showFileBugModal,
      showNotesModal,
      showTagsModal,
      selectedValue,
      isWeekend,
    } = this.state;

    const alertStatus = getStatus(alertSummary.status);
    const alertSummaryActiveTags = alertSummary.performance_tags || [];

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
            submitButtonText="Assign"
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
        <FileBugModal
          showModal={showFileBugModal}
          toggle={() => this.toggle('showFileBugModal')}
          updateAndClose={(event, inputValue) =>
            this.fileBugAndClose(
              event,
              {
                bug_number: parseInt(inputValue, 10),
                issue_tracker: issueTrackers.find(
                  (item) => item.text === selectedValue,
                ).id,
              },
              'showFileBugModal',
            )
          }
          header="File Regression Bug for"
          title="Enter Bug Number"
          submitButtonText="File Bug"
        />
        <NotesModal
          showModal={showNotesModal}
          toggle={() => this.toggle('showNotesModal')}
          alertSummary={alertSummary}
          updateAndClose={this.updateAndClose}
        />
        <TagsModal
          showModal={showTagsModal}
          toggle={() => this.toggle('showTagsModal')}
          alertSummary={alertSummary}
          performanceTags={performanceTags}
          updateAndClose={this.updateAndClose}
        />
        <UncontrolledDropdown tag="span" className="status-drop-down-container">
          <DropdownToggle className="btn-xs" color="darker-secondary" caret>
            {getStatus(alertSummary.status)}
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem tag="a" onClick={this.copySummary}>
              Copy Summary
            </DropdownItem>
            {!alertSummary.bug_number && (
              <DropdownItem
                tag="a"
                onClick={() => this.toggle('showFileBugModal')}
              >
                File bug
              </DropdownItem>
            )}
            {user.isStaff && (
              <React.Fragment>
                {!alertSummary.bug_number ? (
                  <DropdownItem
                    tag="a"
                    onClick={() => this.toggle('showBugModal')}
                  >
                    Link to bug
                  </DropdownItem>
                ) : (
                  <DropdownItem
                    tag="a"
                    onClick={() =>
                      this.changeAlertSummary({
                        bug_number: null,
                      })
                    }
                  >
                    Unlink from bug
                  </DropdownItem>
                )}
                <DropdownItem
                  tag="a"
                  onClick={() => this.toggle('showNotesModal')}
                >
                  {!alertSummary.notes ? 'Add notes' : 'Edit notes'}
                </DropdownItem>
                {this.isResolved(alertStatus) && (
                  <DropdownItem
                    tag="a"
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
                    tag="a"
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
                    tag="a"
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
                    tag="a"
                    onClick={() =>
                      this.changeAlertSummary({
                        status: summaryStatusMap.fixed,
                      })
                    }
                  >
                    Mark as fixed
                  </DropdownItem>
                )}

                <DropdownItem
                  tag="a"
                  onClick={() => this.toggle('showTagsModal')}
                >
                  {!alertSummaryActiveTags.length ? 'Add tags' : 'Edit tags'}
                </DropdownItem>
              </React.Fragment>
            )}
          </DropdownMenu>
          {!isWeekend && <AlertStatusCountdown alertSummary={alertSummary} />}
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
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

StatusDropdown.defaultProps = {
  issueTrackers: [],
  bugTemplate: null,
  filteredAlerts: [],
};
