import React from 'react';
import PropTypes from 'prop-types';
import difference from 'lodash/difference';

import { createQueryParams } from '../../helpers/url';
import {
  createNoiseMetric,
  getCounterMap,
  createGraphsLinks,
} from '../helpers';
import { noiseMetricTitle, phTimeRanges } from '../constants';
import withValidation from '../Validation';

import CompareTableView from './CompareTableView';

class CompareView extends React.PureComponent {
  getInterval = (oldTimestamp, newTimestamp) => {
    const now = new Date().getTime() / 1000;
    let timeRange = Math.min(oldTimestamp, newTimestamp);
    timeRange = Math.round(now - timeRange);
    const newTimeRange = phTimeRanges.find((time) => timeRange <= time.value);
    return newTimeRange.value;
  };

  queryParams = (repository, interval, framework) => ({
    repository,
    framework,
    interval,
    no_subtests: true,
  });

  getQueryParams = (timeRange, framework) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      newResultSet,
      originalResultSet,
    } = this.props.validated;

    let originalParams;
    let interval;

    if (originalRevision) {
      interval = this.getInterval(
        originalResultSet.push_timestamp,
        newResultSet.push_timestamp,
      );
      originalParams = this.queryParams(
        originalProject,
        interval,
        framework.id,
      );
      originalParams.revision = originalRevision;
    } else {
      interval = timeRange.value;
      const startDateMs = (newResultSet.push_timestamp - interval) * 1000;
      const endDateMs = newResultSet.push_timestamp * 1000;

      originalParams = this.queryParams(
        originalProject,
        interval,
        framework.id,
      );
      originalParams.startday = new Date(startDateMs)
        .toISOString()
        .slice(0, -5);
      originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
    }

    const newParams = this.queryParams(newProject, interval, framework.id);
    newParams.revision = newRevision;
    return [originalParams, newParams];
  };

  createLinks = (oldResults, newResults, timeRange, framework) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.props.validated;

    let links = [];
    const hasSubtests =
      (oldResults && oldResults.has_subtests) ||
      (newResults && newResults.has_subtests);

    if (hasSubtests) {
      const params = {
        originalProject,
        newProject,
        newRevision,
        originalSignature: oldResults ? oldResults.signature_id : null,
        newSignature: newResults ? newResults.signature_id : null,
        framework: framework.id,
      };

      if (originalRevision) {
        params.originalRevision = originalRevision;
      } else {
        params.selectedTimeRange = timeRange.value;
      }

      const detailsLink = `perf.html#/comparesubtest${createQueryParams(
        params,
      )}`;

      links.push({
        title: 'subtests',
        href: detailsLink,
      });
    }
    const signatureHash = !oldResults
      ? newResults.signature_hash
      : oldResults.signature_hash;
    links = createGraphsLinks(
      this.props.validated,
      links,
      framework,
      timeRange,
      signatureHash,
    );
    return links;
  };

  getDisplayResults = (origResultsMap, newResultsMap, state) => {
    const { rowNames, tableNames, framework, timeRange } = state;

    let compareResults = new Map();
    const oldStddevVariance = {};
    const newStddevVariance = {};
    const testsWithNoise = [];

    tableNames.forEach((testName) => {
      rowNames.forEach((value) => {
        if (!oldStddevVariance[value]) {
          oldStddevVariance[value] = {
            values: [],
            lower_is_better: true,
            frameworkID: framework.id,
          };
        }
        if (!newStddevVariance[value]) {
          newStddevVariance[value] = {
            values: [],
            frameworkID: framework.id,
          };
        }

        const oldResults = origResultsMap.find(
          (sig) => sig.name === testName && sig.platform === value,
        );
        const newResults = newResultsMap.find(
          (sig) => sig.name === testName && sig.platform === value,
        );

        const cmap = getCounterMap(testName, oldResults, newResults);
        if (cmap.isEmpty) {
          return;
        }
        cmap.name = value;

        if (
          cmap.originalStddevPct !== undefined &&
          cmap.newStddevPct !== undefined
        ) {
          if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
            oldStddevVariance[value].values.push(
              Math.round(cmap.originalStddevPct * 100) / 100,
            );
            newStddevVariance[value].values.push(
              Math.round(cmap.newStddevPct * 100) / 100,
            );
          } else {
            const noise = {
              baseStddev: cmap.originalStddevPct,
              newStddev: cmap.newStddevPct,
              platform: value,
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

        if (compareResults.has(testName)) {
          compareResults.get(testName).push(cmap);
        } else {
          compareResults.set(testName, [cmap]);
        }
      });
    });

    rowNames.forEach((value) => {
      const cmap = getCounterMap(
        noiseMetricTitle,
        oldStddevVariance[value],
        newStddevVariance[value],
      );
      if (cmap.isEmpty) {
        return;
      }
      compareResults = createNoiseMetric(cmap, value, compareResults);
    });

    compareResults = new Map([...compareResults.entries()].sort());
    const updates = { compareResults, testsWithNoise, loading: false };
    this.props.updateAppState({ compareData: compareResults });

    const resultsArr = Array.from(compareResults.keys());
    const testsNoResults = difference(tableNames, resultsArr).sort().join(', ');

    if (testsNoResults.length) {
      updates.testsNoResults = testsNoResults;
    }

    return updates;
  };

  getHashFragment = () => this.props.location.hash;

  render() {
    return (
      <CompareTableView
        {...this.props}
        getQueryParams={this.getQueryParams}
        getDisplayResults={this.getDisplayResults}
        filterByFramework
      />
    );
  }
}

CompareView.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    framework: PropTypes.string,
    updateParams: PropTypes.func.isRequired,
  }),
};

CompareView.defaultProps = {
  validated: PropTypes.shape({}),
};

const requiredParams = new Set([
  'originalProject',
  'newProject',
  'newRevision',
]);

export default withValidation({ requiredParams })(CompareView);
