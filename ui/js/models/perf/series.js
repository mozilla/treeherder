import _ from 'lodash';

import treeherder from '../../treeherder';
import { getProjectUrl, getApiUrl } from '../../../helpers/url';
import OptionCollectionModel from '../../../models/optionCollection';

treeherder.factory('PhSeries', ['$http', '$q', function ($http, $q) {

    const _getTestName = function (signatureProps) {
        // only return suite name if testname is identical, and handle
        // undefined test name
        return [...new Set([signatureProps.suite, signatureProps.test].filter(item => item))].join(' ');
    };

    const _getSeriesOptions = function (signatureProps, optionCollectionMap) {
        let options = [optionCollectionMap[signatureProps.option_collection_hash]];
        if (signatureProps.extra_options) {
            options = options.concat(signatureProps.extra_options);
        }
        return [...new Set(options)];
    };

    const _getSeriesName = function (signatureProps, optionCollectionMap,
                                  displayOptions) {
        const platform = signatureProps.machine_platform;
        let name = _getTestName(signatureProps);

        if (displayOptions && displayOptions.includePlatformInName) {
            name = name + ' ' + platform;
        }
        const options = _getSeriesOptions(signatureProps, optionCollectionMap);
        return name + ' ' + options.join(' ');
    };

    const _getSeriesSummary = function (projectName, signature, signatureProps,
                                     optionCollectionMap) {
        const platform = signatureProps.machine_platform;
        const options = _getSeriesOptions(signatureProps, optionCollectionMap);

        return {
            id: signatureProps.id,
            name: _getSeriesName(signatureProps, optionCollectionMap),
            testName: _getTestName(signatureProps), // unadorned with platform/option info
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
                            signatureProps.lower_is_better),
        };
    };

    return {
        getTestName: _getTestName,
        getSeriesName: _getSeriesName,
        getSeriesList: function (projectName, params) {
            return OptionCollectionModel.getMap().then(function (optionCollectionMap) {
                return $http.get(
                    getProjectUrl('/performance/signatures/', projectName),
                    { params: params }).then(function (response) {
                         return response.data.map(function (signatureProps, signature) {
                             return _getSeriesSummary(projectName, signature,
                                                      signatureProps,
                                                      optionCollectionMap);
                         });
                     });
            });
        },
        getPlatformList: function (projectName, params) {
            return $http.get(
                getProjectUrl('/performance/platforms/', projectName),
                { params: params }).then(function (response) {
                    return response.data;
                });
        },
        getSeriesData: function (projectName, params) {
            return $http.get(
                getProjectUrl('/performance/data/', projectName),
                { params: params }).then(function (response) {
                    if (response.data) {
                        return response.data;
                    }
                    return $q.reject('No series data found');
                });
        },
        getReplicateData: function (params) {
            params.value = 'perfherder-data.json';
            return $http.get(
                getApiUrl('/jobdetail/'),
                { params: params }).then(
                    function (response) {
                        if (response.data.results[0]) {
                            const url = response.data.results[0].url;
                            return $http.get(url).then(function (response) {
                                return response.data;
                            });
                        }
                        return $q.reject('No replicate data found');
                    });
        },
    };
}]);
