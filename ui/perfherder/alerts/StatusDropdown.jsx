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
import { getData, create } from '../../helpers/http';
import TextualSummary from '../perf-helpers/textualSummary';
import { getApiUrl, bzBaseUrl, bugzillaBugsApi } from '../../helpers/url';
import { summaryStatusMap, criticalTestsList } from '../perf-helpers/constants';
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
      bugTemplate,
      updateViewState,
      filteredAlerts,
      frameworks,
      user,
    } = this.props;
    const { browsertimeAlertsExtraData, showCriticalFileBugModal } = this.state;
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
    const frameworkName = getFrameworkName(frameworks, alertSummary.framework);
    const templateArgs = {
      bugType: 'defect',
      framework: frameworkName,
      revision: alertSummary.revision,
      revisionHref: repoModel.getPushLogHref(alertSummary.revision),
      alertHref: `${window.location.origin}/perfherder/alerts?id=${alertSummary.id}`,
      alertSummary: textualSummary.markdown,
      alertSummaryId: alertSummary.id,
      user: user.email,
    };

    if (showCriticalFileBugModal) {
      templateArgs.criticalTests = criticalTestsList[frameworkName];
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
    return {
      failureStatus: null,
    };
  };

  copySummary = async () => {
    const { alertSummary, repoModel, filteredAlerts, frameworks } = this.props;
    const { browsertimeAlertsExtraData } = this.state;
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
      alertSummaryId: alertSummary.id,
    };
    const containsRegression = textualSummary.alerts.some(
      (item) => item.is_regression === true,
    );

    const regressionTemplate = `
Perfherder has detected a {{ framework }} performance change from push [{{ revision }}]({{ revisionHref }}). As author of one of the patches included in that push, we need your help to address this regression.

Please **acknowledge, and begin investigating this alert within 3 business days, or the patch(es) may be backed out** in accordance with our [regression policy](https://www.mozilla.org/en-US/about/governance/policies/regressions/). Our [guide to handling regression bugs](https://firefox-source-docs.mozilla.org/testing/perfdocs/perftest-in-a-nutshell.html#help-i-have-a-regression-what-do-i-do) has information about how you can proceed with this investigation.

If you have any questions or need any help with the investigation, please reach out to a performance sheriff. Alternatively, you can find help on Slack by joining [#perf-help](https://mozilla.enterprise.slack.com/archives/C03U19JCSFQ), and on Matrix you can find help by joining [#perftest](https://matrix.to/#/#perftest:mozilla.org).

{{ alertSummary }}

Details of the alert can be found in the [alert summary]({{ alertHref }}), including links to graphs and comparisons for each of the affected tests.

If you need the profiling jobs [you can trigger them yourself from treeherder job view](https://firefox-source-docs.mozilla.org/testing/perfdocs/perftest-in-a-nutshell.html#using-the-firefox-profiler) or ask a performance sheriff to do that for you.

You can run all of these tests on try with \`./mach try perf --alert {{ alertSummaryId }}\`

The following [documentation link](https://firefox-source-docs.mozilla.org/testing/perfdocs/mach-try-perf.html#running-alert-tests) provides more information about this command.
    `;

    const improvementTemplate = `
Perfherder has detected a {{ framework }} performance change from push [{{ revision }}]({{ revisionHref }}).

If you have any questions, please reach out to a performance sheriff. Alternatively, you can find help on Slack by joining [#perf-help](https://mozilla.enterprise.slack.com/archives/C03U19JCSFQ), and on Matrix you can find help by joining [#perftest](https://matrix.to/#/#perftest:mozilla.org).

{{ alertSummary }}

Details of the alert can be found in the [alert summary]({{ alertHref }}), including links to graphs and comparisons for each of the affected tests.

If you need the profiling jobs [you can trigger them yourself from treeherder job view](https://firefox-source-docs.mozilla.org/testing/perfdocs/perftest-in-a-nutshell.html#using-the-firefox-profiler) or ask a performance sheriff to do that for you.

You can run all of these tests on try with \`./mach try perf --alert {{ alertSummaryId }}\`

The following [documentation link](https://firefox-source-docs.mozilla.org/testing/perfdocs/mach-try-perf.html#running-alert-tests) provides more information about this command.
    `;

    const templateText = containsRegression
      ? regressionTemplate
      : improvementTemplate;

    templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    const fillTemplate = template(templateText);
    const commentText = fillTemplate(templateArgs);

    // can't access the clipboardData on event unless it's done from react's
    // onCopy, onCut or onPaste props so using this workaround
    navigator.clipboard.writeText(commentText).then(() => {});
  };

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
            <DropdownItem tag="a" onClick={this.copySummary}>
              Copy Summary
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
  bugTemplate: PropTypes.shape({}),
  filteredAlerts: PropTypes.arrayOf(PropTypes.shape({})),
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

StatusDropdown.defaultProps = {
  issueTrackers: [],
  bugTemplate: null,
  filteredAlerts: [],
};
