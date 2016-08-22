"use strict";

treeherder.factory('PhSeries', ['$http', 'thServiceDomain', 'ThOptionCollectionModel', '$q', function($http, thServiceDomain, ThOptionCollectionModel, $q) {

    var _getTestName = function(signatureProps, displayOptions) {
        var suiteName = signatureProps.suite;
        var testName = signatureProps.test;

        if (! (displayOptions && displayOptions.abbreviate)) {
            // "summary" may appear for non-abbreviated output
            testName = testName || "summary";
        }

        return suiteName === testName ? suiteName : suiteName + " " + testName;
    };

    var _getSeriesOptions = function(signatureProps, optionCollectionMap) {
        var options = [ optionCollectionMap[signatureProps.option_collection_hash] ];
        if (signatureProps.test_options) {
            options = options.concat(signatureProps.test_options);
        }
        return options;
    };

    var _getSeriesName = function(signatureProps, optionCollectionMap,
                                  displayOptions) {
        var platform = signatureProps.machine_platform;
        var name = _getTestName(signatureProps);

        if (displayOptions && displayOptions.includePlatformInName) {
            name = name + " " + platform;
        }
        var options = _getSeriesOptions(signatureProps, optionCollectionMap);
        return name + " " + options.join(" ");
    };

    var _getSeriesSummary = function(projectName, signature, signatureProps,
                                     optionCollectionMap) {
        var platform = signatureProps.machine_platform;
        var options = _getSeriesOptions(signatureProps, optionCollectionMap);

        return {
            id: signatureProps['id'],
            name: _getSeriesName(signatureProps, optionCollectionMap),
            testName: _getTestName(signatureProps), // unadorned with platform/option info
            suite: signatureProps['suite'],
            test: signatureProps['test'] || null,
            signature: signature,
            hasSubtests: signatureProps['has_subtests'] || false,
            parentSignature: signatureProps['parent_signature'] || null,
            projectName: projectName,
            platform: platform,
            options: options,
            frameworkId: signatureProps.framework_id,
            lowerIsBetter: (signatureProps.lower_is_better === undefined ||
                            signatureProps.lower_is_better)
        };
    };

    return {
        getTestName: _getTestName,
        getSeriesName: _getSeriesName,
        getSeriesList: function(projectName, params) {
            return ThOptionCollectionModel.getMap().then(function(optionCollectionMap) {
                return $http.get(thServiceDomain + '/api/project/' + projectName +
                                 '/performance/signatures/', { params: params }).then(function(response) {
                                     return _.map(response.data, function(signatureProps, signature) {
                                         return _getSeriesSummary(projectName, signature,
                                                                  signatureProps,
                                                                  optionCollectionMap);
                                     });
                                 });
            });
        },
        getPlatformList: function(projectName, params) {
            return $http.get(thServiceDomain + '/api/project/' + projectName +
                             '/performance/platforms/', { params: params }).then(
                                 function(response) {
                                     return response.data;
                                 });
        },
        getSeriesData: function(projectName, params) {
            return $http.get(thServiceDomain + '/api/project/' + projectName + '/performance/data/',
                             { params: params }).then(function(response) {
                                 if(response.data) {
                                     return response.data;
                                 }
                                 return $q.reject("No series data found");
                             });
        }
    };
}]);
