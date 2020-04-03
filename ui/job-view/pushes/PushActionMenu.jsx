import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

import { getUrlParam } from '../../helpers/location';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import { getPushHealthUrl, getCompareChooserUrl } from '../../helpers/url';
import { notify } from '../redux/stores/notifications';
import { thEvents } from '../../helpers/constants';

// Trigger missing jobs is dangerous on repos other than these (see bug 1335506)
const triggerMissingRepos = ['mozilla-inbound', 'autoland'];

class PushActionMenu extends React.PureComponent {
  constructor(props) {
    super(props);

    const { revision } = this.props;

    this.state = {
      topOfRangeUrl: this.getRangeChangeUrl('tochange', revision),
      bottomOfRangeUrl: this.getRangeChangeUrl('fromchange', revision),
      customJobActionsShowing: false,
    };
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.handleUrlChanges, false);
    window.addEventListener(thEvents.filtersUpdated, this.handleUrlChanges);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
    window.removeEventListener(thEvents.filtersUpdated, this.handleUrlChanges);
  }

  getRangeChangeUrl(param, revision) {
    let url = window.location.href;
    url = url.replace(`&${param}=${getUrlParam(param)}`, '');
    url = url.replace(`&${'selectedJob'}=${getUrlParam('selectedJob')}`, '');
    return `${url}&${param}=${revision}`;
  }

  handleUrlChanges = () => {
    const { revision } = this.props;

    this.setState({
      topOfRangeUrl: this.getRangeChangeUrl('tochange', revision),
      bottomOfRangeUrl: this.getRangeChangeUrl('fromchange', revision),
    });
  };

  triggerMissingJobs = () => {
    const {
      notify,
      revision,
      pushId,
      currentRepo,
      decisionTaskMap,
    } = this.props;
    const decisionTask = decisionTaskMap[pushId];

    if (
      !window.confirm(
        `This will trigger all missing jobs for revision ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    PushModel.triggerMissingJobs(
      pushId,
      notify,
      decisionTask,
      currentRepo,
    ).catch(e => {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    });
  };

  toggleCustomJobActions = () => {
    const { customJobActionsShowing } = this.state;

    this.setState({ customJobActionsShowing: !customJobActionsShowing });
  };

  render() {
    const {
      isLoggedIn,
      revision,
      runnableVisible,
      hideRunnableJobs,
      showRunnableJobs,
      showFuzzyJobs,
      pushId,
      currentRepo,
    } = this.props;
    const {
      topOfRangeUrl,
      bottomOfRangeUrl,
      customJobActionsShowing,
    } = this.state;

    return (
      <React.Fragment>
        <UncontrolledDropdown className="btn-group">
          <DropdownToggle
            size="sm"
            className="btn-push"
            title="Action menu"
            data-testid="push-action-menu-button"
            caret
          />
          <DropdownMenu>
            {runnableVisible ? (
              <DropdownItem
                tag="a"
                title="Hide Runnable Jobs"
                onClick={hideRunnableJobs}
              >
                Hide Runnable Jobs
              </DropdownItem>
            ) : (
              <DropdownItem
                tag="a"
                title={
                  isLoggedIn ? 'Add new jobs to this push' : 'Must be logged in'
                }
                className={isLoggedIn ? '' : 'disabled'}
                onClick={showRunnableJobs}
              >
                Add new jobs
              </DropdownItem>
            )}
            <DropdownItem
              tag="a"
              title={
                isLoggedIn
                  ? 'Add new jobs to this push via a fuzzy search'
                  : 'Must be logged in'
              }
              className={isLoggedIn ? '' : 'disabled'}
              onClick={showFuzzyJobs}
            >
              Add new jobs (Search)
            </DropdownItem>
            {triggerMissingRepos.includes(currentRepo.name) && (
              <DropdownItem
                tag="a"
                title={
                  isLoggedIn
                    ? 'Trigger all jobs that were optimized away'
                    : 'Must be logged in'
                }
                className={isLoggedIn ? '' : 'disabled'}
                onClick={this.triggerMissingJobs}
              >
                Trigger missing jobs
              </DropdownItem>
            )}
            <DropdownItem
              tag="a"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://bugherder.mozilla.org/?cset=${revision}&tree=${currentRepo.name}`}
              title="Use Bugherder to mark the bugs in this push"
            >
              Mark with Bugherder
            </DropdownItem>
            <DropdownItem
              tag="a"
              onClick={this.toggleCustomJobActions}
              title="View/Edit/Submit Action tasks for this push"
            >
              Custom Push Action...
            </DropdownItem>
            <DropdownItem
              tag="a"
              href={topOfRangeUrl}
              data-testid="top-of-range-menu-item"
            >
              Set as top of range
            </DropdownItem>
            <DropdownItem
              tag="a"
              href={bottomOfRangeUrl}
              data-testid="bottom-of-range-menu-item"
            >
              Set as bottom of range
            </DropdownItem>
            <DropdownItem divider />
            <DropdownItem
              tag="a"
              href={getPushHealthUrl({ repo: currentRepo.name, revision })}
              target="_blank"
              rel="noopener noreferrer"
              title="Enable Health Badges in the Health menu"
            >
              Push Health
            </DropdownItem>
            <DropdownItem
              tag="a"
              href={getCompareChooserUrl({
                newProject: currentRepo.name,
                newRevision: revision,
              })}
              target="_blank"
              rel="noopener noreferrer"
              title="Compare performance against another revision"
            >
              Compare Performance
            </DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
        {customJobActionsShowing && (
          <CustomJobActions
            job={null}
            pushId={pushId}
            isLoggedIn={isLoggedIn}
            currentRepo={currentRepo}
            toggle={this.toggleCustomJobActions}
          />
        )}
      </React.Fragment>
    );
  }
}

PushActionMenu.propTypes = {
  runnableVisible: PropTypes.bool.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.object.isRequired,
  decisionTaskMap: PropTypes.object.isRequired,
  pushId: PropTypes.number.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify })(PushActionMenu);
