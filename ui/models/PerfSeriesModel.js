import { getApiUrl, getProjectUrl } from "../helpers/urlHelper";
import ThOptionCollectionModel from './OptionCollectionModel';

export default class PerfSeriesModel {
  constructor() {
    this.optionCollectionModel = new ThOptionCollectionModel();
  }

  getTestName(signatureProps) {
    // only return suite name if testname is identical, and handle
    // undefined test name
    return _.uniq(_.filter([signatureProps.suite, signatureProps.test])).join(" ");
  }

  getSeriesOptions(signatureProps, optionCollectionMap) {
    let options = [optionCollectionMap[signatureProps.option_collection_hash]];
    if (signatureProps.extra_options) {
      options = options.concat(signatureProps.extra_options);
    }
    return _.uniq(options);
  }

  getSeriesName(signatureProps, optionCollectionMap,
                displayOptions) {
    const platform = signatureProps.machine_platform;
    let name = this.getTestName(signatureProps);

    if (displayOptions && displayOptions.includePlatformInName) {
      name = name + " " + platform;
    }
    const options = this.getSeriesOptions(signatureProps, optionCollectionMap);
    return `${name} ${options.join(' ')}`;
  }

  getSeriesSummary(projectName, signature, signatureProps,
                   optionCollectionMap) {
    const platform = signatureProps.machine_platform;
    const options = this.getSeriesOptions(signatureProps, optionCollectionMap);

    return {
      id: signatureProps.id,
      name: this.getSeriesName(signatureProps, optionCollectionMap),
      testName: this.getTestName(signatureProps), // unadorned with platform/option info
      suite: signatureProps.suite,
      test: signatureProps.test || null,
      signature: signature,
      hasSubtests: signatureProps.has_subtests || false,
      parentSignature: signatureProps.parent_signature || null,
      projectName: projectName,
      platform: platform,
      options: options,
      frameworkId: signatureProps.framework_id,
      lowerIsBetter: (signatureProps.lower_is_better === undefined ||
        signatureProps.lower_is_better)
    };
  }

  getSeriesList(projectName, params) {
    return this.optionCollectionModel.getMap().then(optionCollectionMap => (
      fetch(getProjectUrl('/performance/signatures/', projectName), { params })
        .then(response => (
          _.map(response.data, (signatureProps, signature) => (
            this.getSeriesSummary(projectName, signature,
                                  signatureProps,
                                  optionCollectionMap)
          ))
        ))
    ));
  }

  getPlatformList(projectName, params) {
    return fetch(
      getProjectUrl('/performance/platforms/', projectName),
      { params }).then(function (response) {
      return response.data;
    });
  }

  getSeriesData(repoName, params) {
    return fetch(
      getProjectUrl('/performance/data/', repoName),
      { params }).then(function (response) {
      if (response.data) {
        return response.data;
      }
      return Promise.reject(new Error("No series data found"));
    });
  }

  getReplicateData(params) {
    params.value = 'perfherder-data.json';
    return fetch(
      getApiUrl('/jobdetail/'),
      { params }).then(
      function (response) {
        if (response.data.results[0]) {
          const url = response.data.results[0].url;
          return fetch(url).then(function (response) {
            return response.data;
          });
        }
        return Promise.reject(new Error("No replicate data found"));
      });
  }


}
