import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';
import { push as pushRoute } from 'connected-react-router';

import {
  createQueryParams,
  getPushHealthUrl,
  getCompareChooserUrl,
  parseQueryParams,
} from '../../helpers/url';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import { notify } from '../redux/stores/notifications';
import { updateRange } from '../redux/stores/pushes';

class PushActionMenu extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      customJobActionsShowing: false,
    };
  }

  updateParamsAndRange = (param) => {
    const { revision, updateRange, pushRoute } = this.props;

    let queryParams = parseQueryParams(window.location.search);
    queryParams = { ...queryParams, ...{ [param]: revision } };

    pushRoute({
      search: createQueryParams(queryParams),
    });
    updateRange(queryParams);
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
    ).catch((e) => {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    });
  };

  toggleCustomJobActions = () => {
    const { customJobActionsShowing } = this.state;

    this.setState({ customJobActionsShowing: !customJobActionsShowing });
  };

  render() {
    const {
      revision,
      runnableVisible,
      hideRunnableJobs,
      showRunnableJobs,
      showFuzzyJobs,
      pushId,
      currentRepo,
    } = this.props;
    const { customJobActionsShowing } = this.state;

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
                title="Add new jobs to this push"
                onClick={showRunnableJobs}
              >
                Add new jobs
              </DropdownItem>
            )}
            <DropdownItem
              tag="a"
              title="Add new jobs to this push via a fuzzy search"
              onClick={showFuzzyJobs}
            >
              Add new jobs (Search)
            </DropdownItem>
            <DropdownItem
              tag="a"
              title="Trigger all jobs that were optimized away"
              onClick={this.triggerMissingJobs}
            >
              Trigger missing jobs
            </DropdownItem>
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
              onClick={() => this.updateParamsAndRange('tochange')}
              data-testid="top-of-range-menu-item"
            >
              Set as top of range
            </DropdownItem>
            <DropdownItem
              tag="a"
              onClick={() => this.updateParamsAndRange('fromchange')}
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
  revision: PropTypes.string,
  currentRepo: PropTypes.shape({
    name: PropTypes.string,
  }).isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  pushId: PropTypes.number.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

PushActionMenu.defaultProps = {
  revision: null,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify, updateRange, pushRoute })(
  PushActionMenu,
);
