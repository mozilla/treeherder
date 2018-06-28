import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import SplitPane from 'react-split-pane';
import { createBrowserHistory } from 'history';

import treeherder from '../js/treeherder';
import { thEvents } from '../js/constants';
import DetailsPanel from './details/DetailsPanel';
import ActiveFilters from './navbars/ActiveFilters';
import PushList from './PushList';

const DEFAULT_DETAILS_PCT = 40;

const getWindowHeight = function () {
  const windowHeight = window.innerHeight;
  const navBar = document.getElementById('th-global-navbar');
  const navBarHeight = navBar ? navBar.clientHeight : 0;

  return windowHeight - navBarHeight;
};

class JobView extends React.Component {
  static getDerivedStateFromProps(props) {
    return JobView.getSplitterDimensions(props);
  }

  static getSplitterDimensions(props) {
    const { selectedJob } = props;
    const defaultPushListPct = selectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
    // calculate the height of the details panel to use if it has not been
    // resized by the user.
    const defaultDetailsHeight = defaultPushListPct < 100 ?
      DEFAULT_DETAILS_PCT / 100 * getWindowHeight() : 0;

    return {
      defaultPushListPct,
      defaultDetailsHeight,
    };
  }

  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thJobFilters = $injector.get('thJobFilters');
    this.$rootScope = $injector.get('$rootScope');

    this.history = createBrowserHistory();

    this.state = {
      isFieldFilterVisible: false,
      filterBarFilters: [
       ...this.thJobFilters.getNonFieldFiltersArray(),
       ...this.thJobFilters.getFieldFiltersArray(),
      ],
      pushListPct: props.selectedJob ? 100 - DEFAULT_DETAILS_PCT : 100,
    };
  }

  componentDidMount() {
    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);

    window.addEventListener('resize', this.updateDimensions);

    this.$rootScope.$on(thEvents.toggleFieldFilterVisible, () => {
      this.toggleFieldFilterVisible();
    });

    this.history.listen(() => {
      this.setState({
        filterBarFilters: [
         ...this.thJobFilters.getNonFieldFiltersArray(),
         ...this.thJobFilters.getFieldFiltersArray(),
        ],
      });
    });
  }

  toggleFieldFilterVisible() {
    this.setState({ isFieldFilterVisible: !this.state.isFieldFilterVisible });
  }

  updateDimensions() {
    this.setState(JobView.getSplitterDimensions(this.props));
  }

  handleSplitChange(latestSplitSize) {
    this.setState({
      latestSplitPct: latestSplitSize / getWindowHeight() * 100,
    });
  }

  render() {
    const {
      user, repoName, revision, currentRepo, selectedJob, $injector,
    } = this.props;
    const {
      isFieldFilterVisible, filterBarFilters,
      defaultPushListPct, defaultDetailsHeight, latestSplitPct,
    } = this.state;
    // SplitPane will adjust the CSS height of the top component, but not the
    // bottom component.  So the scrollbars won't work in the DetailsPanel when
    // we resize.  Therefore, we must calculate the new
    // height of the DetailsPanel based on the current height of the PushList.
    // Reported this upstream: https://github.com/tomkp/react-split-pane/issues/282
    const pushListPct = latestSplitPct === undefined || !selectedJob ?
      defaultPushListPct :
      latestSplitPct;
    const detailsHeight = latestSplitPct === undefined || !selectedJob ?
      defaultDetailsHeight :
      getWindowHeight() * (1 - latestSplitPct / 100);

    return (
      <SplitPane
        split="horizontal"
        size={`${pushListPct}%`}
        onDragFinished={size => this.handleSplitChange(size)}
      >
        <div className="d-flex flex-column w-100">
          {(isFieldFilterVisible || !!filterBarFilters.length) && <ActiveFilters
            $injector={$injector}
            filterBarFilters={filterBarFilters}
            history={this.history}
            isFieldFilterVisible={isFieldFilterVisible}
            toggleFieldFilterVisible={this.toggleFieldFilterVisible}
          />}
          <div id="th-global-content" className="th-global-content">
            <span className="th-view-content">
              <PushList
                user={user}
                repoName={repoName}
                revision={revision}
                currentRepo={currentRepo}
                $injector={$injector}
              />
            </span>
          </div>
        </div>
        <DetailsPanel
          resizedHeight={detailsHeight}
          currentRepo={currentRepo}
          repoName={repoName}
          selectedJob={selectedJob}
          user={user}
          $injector={$injector}
        />
      </SplitPane>
    );
  }
}

JobView.propTypes = {
  $injector: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
  selectedJob: PropTypes.object,
};

// Sometime of these props are not ready by the time this renders, so
// need some defaults for them.
JobView.defaultProps = {
  revision: null,
  currentRepo: {},
  selectedJob: null,
};

treeherder.component('jobView', react2angular(
  JobView,
  ['repoName', 'user', 'revision', 'currentRepo', 'selectedJob'],
  ['$injector']));
