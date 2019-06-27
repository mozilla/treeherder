import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import difference from 'lodash/difference';

import perf from '../../js/perf';
import { createQueryParams } from '../../helpers/url';
import {
  createNoiseMetric,
  getCounterMap,
  createGraphsLinks,
} from '../helpers';
import { noiseMetricTitle } from '../constants';
import withValidation from '../Validation';

import CompareTableView from './CompareTableView';

// TODO remove $stateParams and $state after switching to react router
export class CompareSubtestsView extends React.PureComponent {
  createQueryParams = (parent_signature, repository, framework) => ({
    parent_signature,
    framework,
    repository,
  });

  getQueryParams = (timeRange, framework) => {
    const { validated } = this.props;
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      newResultSet,
      originalSignature,
      newSignature,
    } = validated;

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

  createLinks = (oldResults, newResults, timeRange, framework) => {
    const { validated } = this.props;
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = validated;
    let links = [];

    if (
      (framework.name === 'talos' ||
        framework.name === 'raptor' ||
        framework.name === 'devtools') &&
      originalRevision
    ) {
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
    const signature_hash = !oldResults
      ? newResults.signature_hash
      : oldResults.signature_hash;

    links = createGraphsLinks(
      validated,
      links,
      framework,
      timeRange,
      signature_hash,
    );
    return links;
  };

  getDisplayResults = (origResultsMap, newResultsMap, state) => {
    const { validated } = this.props;
    const { originalSignature, newSignature } = validated;

    const { tableNames, rowNames, framework, timeRange } = state;
    const testsWithNoise = [];
    let compareResults = new Map();
    const parentTestName = tableNames[0];

    const oldStddevVariance = {
      values: [],
      lower_is_better: true,
      frameworkID: framework.id,
    };
    const newStddevVariance = {
      values: [],
      lower_is_better: true,
      frameworkID: framework.id,
    };

    rowNames.forEach(testName => {
      const oldResults = origResultsMap.find(sig => sig.test === testName);
      const newResults = newResultsMap.find(sig => sig.test === testName);

      const cmap = getCounterMap(testName, oldResults, newResults);
      if (cmap.isEmpty) {
        return;
      }
      cmap.name = testName;

      if (
        (oldResults && oldResults.parent_signature === originalSignature) ||
        (oldResults && oldResults.parent_signature === newSignature) ||
        newResults.parent_signature === originalSignature ||
        newResults.parent_signature === newSignature
      ) {
        cmap.highlightedTest = true;
      }

      if (
        cmap.originalStddevPct !== undefined &&
        cmap.newStddevPct !== undefined
      ) {
        if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
          oldStddevVariance.values.push(
            Math.round(cmap.originalStddevPct * 100) / 100,
          );
          newStddevVariance.values.push(
            Math.round(cmap.newStddevPct * 100) / 100,
          );
        } else {
          const noise = {
            baseStddev: cmap.originalStddevPct,
            newStddev: cmap.newStddevPct,
            testname: testName,
          };
          testsWithNoise.push(noise);
        }
      }
      cmap.links = this.createLinks(
        oldResults,
        newResults,
        timeRange,
        framework,
      );

      if (compareResults.has(parentTestName)) {
        compareResults.get(parentTestName).push(cmap);
      } else {
        compareResults.set(parentTestName, [cmap]);
      }
    });

    const cmap = getCounterMap(
      noiseMetricTitle,
      oldStddevVariance,
      newStddevVariance,
    );
    if (!cmap.isEmpty) {
      compareResults = createNoiseMetric(cmap, parentTestName, compareResults);
    }

    compareResults = new Map([...compareResults.entries()].sort());
    const updates = { compareResults, testsWithNoise, loading: false };

    const resultsArr = compareResults
      .get(parentTestName)
      .map(value => value.name);
    const testsNoResults = difference(rowNames, resultsArr)
      .sort()
      .join(', ');

    if (testsNoResults.length) {
      updates.testsNoResults = testsNoResults;
    }

    return updates;
  };

  render() {
    return (
      <CompareTableView
        {...this.props}
        getQueryParams={this.getQueryParams}
        getDisplayResults={this.getDisplayResults}
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
