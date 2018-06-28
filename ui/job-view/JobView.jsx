import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { createBrowserHistory } from 'history';

import treeherder from '../js/treeherder';
import { thEvents } from '../js/constants';
import DetailsPanel from './details/DetailsPanel';
import ActiveFilters from './navbars/ActiveFilters';
import PushList from './PushList';

class JobView extends React.Component {
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
    };
  }

  componentDidMount() {
    this.toggleFieldFilterVisible = this.toggleFieldFilterVisible.bind(this);

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

  render() {
    const {
      user, repoName, revision, currentRepo, selectedJob, $injector,
    } = this.props;
    const { isFieldFilterVisible, filterBarFilters } = this.state;

    return (
      <React.Fragment>
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
        <DetailsPanel
          className={selectedJob ? '' : 'hidden'}
          currentRepo={currentRepo}
          repoName={repoName}
          selectedJob={selectedJob}
          user={user}
          $injector={$injector}
        />
      </React.Fragment>
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
