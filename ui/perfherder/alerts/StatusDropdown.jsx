import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Label,
  UncontrolledDropdown,
} from 'reactstrap';
import template from 'lodash/template';
import templateSettings from 'lodash/templateSettings';

import {
  getFilledBugSummary,
  getFrameworkName,
  getStatus,
  updateAlertSummary,
} from '../perf-helpers/helpers';
import { create, getData } from '../../helpers/http';
import TextualSummary from '../perf-helpers/textualSummary';
import { bugzillaBugsApi, bzBaseUrl, getApiUrl } from '../../helpers/url';
import { criticalTestsList, summaryStatusMap } from '../perf-helpers/constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';
import BrowsertimeAlertsExtraData from '../../models/browsertimeAlertsExtraData';
import { isWeekend } from '../perf-helpers/alertCountdownHelper';

import AlertModal from './AlertModal';
import FileBugModal from './FileBugModal';
import NotesModal from './NotesModal';
import TagsModal from './TagsModal';
import AlertStatusCountdown from './AlertStatusCountdown';

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
      fileBugErrorMessage: null,
    };
  }

  getCulpritDetails = async (culpritId) => {
    const bugDetails = await getData(bugzillaBugsApi(`bug/${culpritId}`));
    if (bugDetails.failureStatus) {
      return bugDetails;
    }

    const bugData = bugDetails.data.bugs[0];
    const bugVersion = 'Default';

    let needinfoFrom = '';
    if (bugData.assigned_to !== 'nobody@mozilla.org') {
      needinfoFrom = bugData.assigned_to;
    } else {
      const componentInfo = await getData(
        bugzillaBugsApi(`component/${bugData.product}/${bugData.component}`),
      );
      needinfoFrom = componentInfo.data.triage_owner;
    }

    // Using set because it doesn't keep duplicates by default
    const ccList = new Set([bugData.creator]);

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
      updateViewState,
      filteredAlerts,
      frameworks,
      user,
    } = this.props;
    const { browsertimeAlertsExtraData, showCriticalFileBugModal } = this.state;
    const result = await this.getBugTemplate(
      alertSummary.framework,
      updateViewState,
    );

    const textualSummary = new TextualSummary(
      frameworks,
      filteredAlerts,
      alertSummary,
      null,
      await browsertimeAlertsExtraData.enrichAndRetrieveAlerts(),
    );
    const templateArgs = this.getTemplateArgs(
      frameworks,
      alertSummary,
      repoModel,
      textualSummary,
      user,
    );

    if (showCriticalFileBugModal) {
      templateArgs.criticalTests = criticalTestsList[templateArgs.framework];
    }

    templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    const text = showCriticalFileBugModal ? result.critical_text : result.text;
    const fillTemplate = template(text);
    const commentText = fillTemplate(templateArgs);
    const bugTitle = `${getFilledBugSummary(alertSummary)}`;
    const culpritDetails = await this.getCulpritDetails(culpritId);
    const componentInfo = await getData(
      bugzillaBugsApi(
        `component/${result.default_product}/${result.default_component}`,
      ),
    );

    let defaultParams = {
      type: templateArgs.bugType,
      version: 'unspecified',
      cc: [result.cc_list],
      description: commentText,
      component: result.default_component,
      product: result.default_product,
      keywords: result.keywords,
      summary: bugTitle,
      whiteboard: result.status_whiteboard,
      needinfo_from: componentInfo.data.triage_owner,
      is_backout_requested: showCriticalFileBugModal,
    };

    if (!culpritDetails.failureStatus) {
      let cc = culpritDetails.ccList.add(result.cc_list);
      cc = Array.from(cc);
      defaultParams = {
        ...defaultParams,
        cc,
        needinfo_from: culpritDetails.needinfoFrom,
        component: culpritDetails.component,
        product: culpritDetails.product,
        regressed_by: culpritId,
      };
    }

    const createResult = await create(
      getApiUrl('/bugzilla/create_bug/'),
      defaultParams,
    );
    if (createResult.failureStatus) {
      return {
        failureStatus: createResult.failureStatus,
        data: createResult.data,
      };
    }
    window.open(`${bzBaseUrl}show_bug.cgi?id=${createResult.data.id}`);

    // Link to bug
    const params = {
      bug_number: parseInt(createResult.data.id, 10),
    };
    this.changeAlertSummary(params);

    return {
      failureStatus: null,
    };
  };

  getTemplateArgs(frameworks, alertSummary, repoModel, textualSummary, user) {
    const frameworkName = getFrameworkName(frameworks, alertSummary.framework);
    return {
      bugType: 'defect',
      framework: frameworkName,
      revision: alertSummary.revision,
      revisionHref: repoModel.getPushLogHref(alertSummary.revision),
      alertHref: `${window.location.origin}/perfherder/alerts?id=${alertSummary.id}`,
      alertSummary: textualSummary.markdown,
      alertSummaryId: alertSummary.id,
      user: user.email,
    };
  }

  copySummary = async (isReply = false) => {
    const {
      alertSummary,
      repoModel,
      filteredAlerts,
      frameworks,
      updateViewState,
      user,
    } = this.props;

    const { browsertimeAlertsExtraData } = this.state;
    const result = await this.getBugTemplate(
      alertSummary.framework,
      updateViewState,
    );

    const textualSummary = new TextualSummary(
      frameworks,
      filteredAlerts,
      alertSummary,
      null,
      await browsertimeAlertsExtraData.enrichAndRetrieveAlerts(),
    );
    const templateArgs = this.getTemplateArgs(
      frameworks,
      alertSummary,
      repoModel,
      textualSummary,
      user,
    );

    let templateText;

    const isImprovement = !textualSummary.alerts.some(
      (item) => item.is_regression === true,
    );
    if (isReply || isImprovement) {
      templateText = result.no_action_required_text;
    } else {
      // It's NOT a reply AND there IS a regression
      templateText = result.text;
    }

    templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    const fillTemplate = template(templateText);
    const commentText = fillTemplate(templateArgs);

    // can't access the clipboardData on event unless it's done from react's
    // onCopy, onCut or onPaste props so using this workaround
    navigator.clipboard.writeText(commentText).then(() => {});
  };

  async getBugTemplate(framework, updateViewState) {
    let result;

    const { data, failureStatus } = await getData(
      getApiUrl(`/performance/bug-template/?framework=${framework}`),
    );
    if (failureStatus) {
      updateViewState({
        errorMessages: [`Failed to retrieve bug template: ${data}`],
      });
    } else {
      [result] = data;
    }
    return result;
  }

  toggle = (state) => {
    this.setState((prevState) => ({
      [state]: !prevState[state],
    }));

    if (this.state.showFileBugModal) {
      this.setState({
        fileBugErrorMessage: null,
      });
    }
  };

  updateAndClose = async (event, params, state) => {
    event.preventDefault();
    this.changeAlertSummary(params);
    this.toggle(state);
  };

  fileBugAndClose = async (event, params, state) => {
    event.preventDefault();
    const culpritId = params.bug_number;
    const createResult = await this.fileBug(culpritId);

    if (createResult.failureStatus) {
      this.setState({
        fileBugErrorMessage: `Failure: ${createResult.data}`,
      });
    } else {
      this.toggle(state);
    }
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
    const {
      alertSummary,
      user,
      issueTrackers,
      performanceTags,
      frameworks,
    } = this.props;
    const {
      showBugModal,
      showFileBugModal,
      showCriticalFileBugModal,
      showNotesModal,
      showTagsModal,
      selectedValue,
      isWeekend,
    } = this.state;

    const frameworkName = getFrameworkName(frameworks, alertSummary.framework);
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
          user={user}
          errorMessage={this.state.fileBugErrorMessage}
        />
        <FileBugModal
          showModal={showCriticalFileBugModal}
          toggle={() => this.toggle('showCriticalFileBugModal')}
          updateAndClose={(event, inputValue) =>
            this.fileBugAndClose(
              event,
              {
                bug_number: parseInt(inputValue, 10),
                issue_tracker: issueTrackers.find(
                  (item) => item.text === selectedValue,
                ).id,
              },
              'showCriticalFileBugModal',
            )
          }
          header="Request backout"
          title="Enter Bug Number"
          submitButtonText="Request Backout"
          user={user}
          errorMessage={this.state.fileBugErrorMessage}
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
            <DropdownItem tag="a" onClick={() => this.copySummary()}>
              Copy Summary
            </DropdownItem>
            <DropdownItem tag="a" onClick={() => this.copySummary(true)}>
              Copy Reply Summary
            </DropdownItem>
            {!alertSummary.bug_number && user.isStaff && (
              <DropdownItem
                tag="a"
                onClick={() => this.toggle('showFileBugModal')}
              >
                File bug
              </DropdownItem>
            )}
            {!alertSummary.bug_number &&
              frameworkName in criticalTestsList &&
              user.isStaff && (
                <DropdownItem
                  tag="a"
                  onClick={() => this.toggle('showCriticalFileBugModal')}
                >
                  Request backout
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
  filteredAlerts: PropTypes.arrayOf(PropTypes.shape({})),
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

StatusDropdown.defaultProps = {
  issueTrackers: [],
  filteredAlerts: [],
};
