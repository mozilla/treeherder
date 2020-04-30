import queryString from 'query-string';

import { getProjectUrl } from '../helpers/location';
import { createQueryParams, getArtifactsUrl } from '../helpers/url';
import { getData } from '../helpers/http';

import JobModel from './job';
import OptionCollectionModel from './optionCollection';

export const getTestName = function getTestName(signatureProps) {
  // only return suite name if testname is identical, and handle
  // undefined test name
  return [
    ...new Set(
      [signatureProps.suite, signatureProps.test].filter((item) => item),
    ),
  ].join(' ');
};

export const getSeriesOptions = function getSeriesOptions(
  signatureProps,
  optionCollectionMap,
) {
  let options = [optionCollectionMap[signatureProps.option_collection_hash]];
  if (signatureProps.extra_options) {
    options = options.concat(signatureProps.extra_options);
  }
  return [...new Set(options)];
};

export const getSeriesName = function getSeriesName(
  signatureProps,
  optionCollectionMap,
  displayOptions,
) {
  const platform = signatureProps.machine_platform;
  let name = getTestName(signatureProps);

  if (displayOptions && displayOptions.includePlatformInName) {
    name = `${name} ${platform}`;
  }
  const options = getSeriesOptions(signatureProps, optionCollectionMap);
  return `${name} ${options.join(' ')}`;
};

export const getSeriesSummary = function getSeriesSummary(
  projectName,
  signature,
  signatureProps,
  optionCollectionMap,
) {
  const platform = signatureProps.machine_platform;
  const options = getSeriesOptions(signatureProps, optionCollectionMap);

  return {
    id: signatureProps.id,
    name: getSeriesName(signatureProps, optionCollectionMap),
    testName: getTestName(signatureProps), // unadorned with platform/option info
    suite: signatureProps.suite,
    test: signatureProps.test || null,
    signature,
    hasSubtests: signatureProps.has_subtests || false,
    tags: signatureProps.tags || [],
    parentSignature: signatureProps.parent_signature || null,
    projectName,
    platform,
    options,
    measurementUnit: signatureProps.measurement_unit || '',
    frameworkId: signatureProps.framework_id,
    application: signatureProps.application || null,
    lowerIsBetter:
      signatureProps.lower_is_better === undefined ||
      signatureProps.lower_is_better,
  };
};

export default class PerfSeriesModel {
  constructor() {
    this.optionCollectionMap = null;
  }

  static async getSeriesList(projectName, params) {
    if (!this.optionCollectionMap) {
      this.optionCollectionMap = await OptionCollectionModel.getMap();
    }

    // we use stringify here because for certain params like 'id'
    // the query string needs to be id=1234&id=5678 vs id=123,5678;
    const response = await getData(
      `${getProjectUrl(
        '/performance/signatures/',
        projectName,
      )}?${queryString.stringify(params)}`,
    );

    if (response.failureStatus) {
      return response;
    }
    const data = Object.entries(
      response.data,
    ).map(([signature, signatureProps]) =>
      getSeriesSummary(
        projectName,
        signature,
        signatureProps,
        this.optionCollectionMap,
      ),
    );
    return { data, failureStatus: null };
  }

  static getPlatformList(projectName, params) {
    return getData(
      `${getProjectUrl(
        '/performance/platforms/',
        projectName,
      )}${createQueryParams(params)}`,
    );
  }

  static getSeriesData(projectName, params) {
    return fetch(
      `${getProjectUrl(
        '/performance/data/',
        projectName,
      )}?${queryString.stringify(params)}`,
    ).then((resp) => {
      if (resp.ok) {
        return resp.json();
      }
      return Promise.reject('No series data found');
    });
  }

  static async getReplicateData({ jobId, rootUrl }) {
    const { data, failureStatus } = await JobModel.getList({ id: jobId });

    if (failureStatus || !data.length) {
      return { failureStatus: true, data: ['No data for this job'] };
    }

    const { task_id: taskId, retry_id: run } = data[0];
    const url = getArtifactsUrl({
      taskId,
      run,
      rootUrl,
      artifactPath: 'public/test_info/perfherder-data.json',
    });
    const replicateDatum = await getData(url);
    return replicateDatum;
  }
}
