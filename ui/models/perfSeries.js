import queryString from 'query-string';

import { getApiUrl, getProjectUrl } from '../helpers/url';

import OptionCollectionModel from './optionCollection';

export const getTestName = function getTestName(signatureProps) {
  // only return suite name if testname is identical, and handle
  // undefined test name
  return [...new Set([signatureProps.suite, signatureProps.test].filter(item => item))].join(' ');
};

export const getSeriesOptions = function getSeriesOptions(signatureProps, optionCollectionMap) {
  let options = [optionCollectionMap[signatureProps.option_collection_hash]];
  if (signatureProps.extra_options) {
    options = options.concat(signatureProps.extra_options);
  }
  return [...new Set(options)];
};

export const getSeriesName = function getSeriesName(signatureProps, optionCollectionMap,
                                displayOptions) {
  const platform = signatureProps.machine_platform;
  let name = getTestName(signatureProps);

  if (displayOptions && displayOptions.includePlatformInName) {
    name = `${name} ${platform}`;
  }
  const options = getSeriesOptions(signatureProps, optionCollectionMap);
  return `${name} ${options.join(' ')}`;
};

export const getSeriesSummary = function getSeriesSummary(projectName, signature, signatureProps,
                                   optionCollectionMap) {
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
    parentSignature: signatureProps.parent_signature || null,
    projectName,
    platform,
    options,
    frameworkId: signatureProps.framework_id,
    lowerIsBetter: (signatureProps.lower_is_better === undefined ||
      signatureProps.lower_is_better),
  };
};

export default class PerfSeriesModel {
  static getSeriesList(projectName, params) {
    return OptionCollectionModel.getMap().then(optionCollectionMap =>
      fetch(
        `${getProjectUrl('/performance/signatures/', projectName)}?${queryString.stringify(params)}`,
      ).then(async (resp) => {
        if (resp.ok) {
          const data = await resp.json();
          return Object.entries(data).map(([signature, signatureProps]) => (
            getSeriesSummary(projectName, signature, signatureProps, optionCollectionMap)
          ));
        }
      }),
    );
  }

  static getPlatformList(projectName, params) {
    return fetch(
      `${getProjectUrl('/performance/platforms/', projectName)}?${queryString.stringify(params)}`,
    ).then(async resp => resp.json());
  }

  static getSeriesData(projectName, params) {
    // console.log('getSeriesData query-string', queryString.stringify(params));
    return fetch(
      `${getProjectUrl('/performance/data/', projectName)}?${queryString.stringify(params)}`,
    ).then((resp) => {
      if (resp.ok) {
        return resp.json();
      }
      return Promise.reject('No series data found');
    });
  }

  static getReplicateData(params) {
    const searchParams = { ...params, value: 'perfherder-data.json' };

    return fetch(`${getApiUrl('/jobdetail/')}?${queryString.stringify(searchParams)}`,
      ).then(async (resp) => {
        if (resp.ok) {
          const data = await resp.json();

          if (data.results.length) {
            const { url } = data.results[0];
            return fetch(url).then(resultResp => resultResp.json());
          }
        }
        return Promise.reject('No replicate data found');
      });
  }

}
