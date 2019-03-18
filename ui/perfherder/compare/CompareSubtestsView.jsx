import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import perf from '../../js/perf';
import { createQueryParams } from '../../helpers/url';

import withValidation from './Validation';
import CompareTableView from './CompareTableView';

// TODO remove $stateParams and $state after switching to react router
export class CompareSubtestsView extends React.PureComponent {
  createQueryParams = (parent_signature, repository, framework) => ({
    parent_signature,
    framework,
    repository,
  });

  getQueryParams = (timeRange, framework) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      newResultSet,
      originalSignature,
      newSignature,
    } = this.props.validated;

    const originalParams = this.createQueryParams(
      originalSignature,
      originalProject,
      framework.id,
    );

    if (originalRevision) {
      originalParams.revision = originalRevision;
    } else {
      // can create a helper function for both views
      const startDateMs =
        (newResultSet.push_timestamp - timeRange.value) * 1000;
      const endDateMs = newResultSet.push_timestamp * 1000;
      originalParams.startday = new Date(startDateMs)
        .toISOString()
        .slice(0, -5);
      originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
    }

    const newParams = this.createQueryParams(
      newSignature,
      newProject,
      framework.id,
    );
    newParams.revision = newRevision;
    return [originalParams, newParams];
  };

  getCustomLink = (links, oldResults, newResults, timeRange, framework) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.props.validated;

    if (framework.name === 'talos' && originalRevision) {
      const params = {
        originalProject,
        newProject,
        originalRevision,
        newRevision,
        originalSubtestSignature: oldResults ? oldResults.signature_id : null,
        newSubtestSignature: newResults ? newResults.signature_id : null,
      };

      links.push({
        title: 'replicates',
        href: `perf.html#/comparesubtestdistribution${createQueryParams(
          params,
        )}`,
      });
    }
    return links;
  };

  render() {
    return (
      <CompareTableView
        {...this.props}
        getQueryParams={this.getQueryParams}
        getCustomLink={this.getCustomLink}
        hasSubtests
      />
    );
  }
}

CompareSubtestsView.propTypes = {
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    updateParams: PropTypes.func.isRequired,
    newSignature: PropTypes.string,
    originalSignature: PropTypes.string,
  }),
  $stateParams: PropTypes.shape({}),
  $state: PropTypes.shape({}),
};

CompareSubtestsView.defaultProps = {
  validated: PropTypes.shape({}),
  $stateParams: null,
  $state: null,
};

const requiredParams = new Set([
  'originalProject',
  'newProject',
  'newRevision',
  'originalSignature',
  'newSignature',
]);

const compareSubtestsView = withValidation(requiredParams)(CompareSubtestsView);

perf.component(
  'compareSubtestsView',
  react2angular(compareSubtestsView, [], ['$stateParams', '$state']),
);

export default compareSubtestsView;
