import React from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import PushJobs from './PushJobs';
import { RevisionList } from './RevisionList';
import { store } from './redux/store';
import * as aggregateIds from './aggregateIds';

class Push extends React.Component {
  constructor(props) {
    super(props);
    this.$rootScope = this.props.$injector.get('$rootScope');
    this.aggregateId = aggregateIds.getResultsetTableId(
      this.$rootScope.repoName, this.props.push.id, this.props.push.revision
    );
  }

  render() {
    return (
      <Provider store={store}>
        <div className="row result-set clearfix">
          {this.$rootScope.currentRepo &&
          <RevisionList
            push={this.props.push}
            $injector={this.props.$injector}
            repo={this.$rootScope.currentRepo}
          />}
          <span className="job-list job-list-pad col-7">
            <PushJobs
              push={this.props.push}
              $injector={this.props.$injector}
            />
          </span>
        </div>
      </Provider>
    );
  }
}

Push.propTypes = {
  push: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
};

treeherder.directive('push', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(Push, ['push'], {}, { $injector, store })]);

