/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.factory('ThResultSetModel', ['$rootScope', '$http', '$location', '$q', 'thUrl', 'thResultStatusObject',
                                    'thEvents', 'thServiceDomain', 'ThLog', 'thNotify','ThJobModel',
                                    'thPlatformOrder', 'thOptionOrder',
    function($rootScope, $http, $location, $q, thUrl, thResultStatusObject, thEvents, thServiceDomain,
        ThLog, thNotify, ThJobModel, thPlatformOrder, thOptionOrder) {

    var $log = new ThLog("ThResultSetModel");

    var MAX_RESULTSET_FETCH_SIZE = 100;
    var MAX_RESULTSET_FETCH_SIZE_NOJOBS = 300;

    var convertDates = function(locationParams) {
        // support date ranges.  we must convert the strings to a timezone
        // appropriate timestamp
        $log.debug("locationParams", locationParams);
        if (_.has(locationParams, "startdate")) {
            locationParams.push_timestamp__gte = Date.parse(
                locationParams.startdate)/1000;

            delete locationParams.startdate;
        }
        if (_.has(locationParams, "enddate")) {
            locationParams.push_timestamp__lt = Date.parse(
                locationParams.enddate)/1000 + 84600;

            delete locationParams.enddate;
        }
        return locationParams;
    };

    // get the resultsets for this repo
    return {
        // used for polling new resultsets after initial load
        getResultSetsFromChange: function(repoName, revision, locationParams) {
            locationParams = convertDates(locationParams);
            _.extend(locationParams, {
                fromchange:revision
            });

            return $http.get(
                thUrl.getProjectUrl("/resultset/", repoName),
                {params: locationParams}
            );
        },

        getResultSets: function(repoName, rsOffsetTimestamp, count, resultsetlist, full, keep_filters) {
            rsOffsetTimestamp = typeof rsOffsetTimestamp === 'undefined'?  0: rsOffsetTimestamp;
            count = typeof count === 'undefined'?  10: count;
            full = _.isUndefined(full) ? true: full;
            keep_filters = _.isUndefined(keep_filters) ? true : keep_filters;

            var params = {
                full: full
            };

            if (count > 0) {
                params.count = count;
            }

            if(rsOffsetTimestamp > 0){
                params.push_timestamp__lte = rsOffsetTimestamp;
                // we will likely re-fetch the oldest we already have, but
                // that's not guaranteed.  There COULD be two resultsets
                // with the same timestamp, theoretically.
                if (params.count) {
                    params.count++;
                }
            }

            if(keep_filters){
                // if there are any search params on the url line, they should
                // pass directly to the set of resultsets.
                // with the exception of ``repo``.  That has no effect on the
                // service at this time, but it could be confusing.
                var locationParams = _.clone($location.search());
                delete locationParams.repo;

                // if they submit an offset timestamp, then they have resultsets
                // and are fetching more.  So don't honor the fromchange/tochange
                // or else we won't be able to fetch more resultsets.
                if (rsOffsetTimestamp) {
                    delete locationParams.tochange;
                    delete locationParams.fromchange;
                }

                // if fromchange is requested without a tochange, then
                // allow the user to fetch up to the limit of 100.  Or 300
                // if the ``nojobs`` param is passed.
                if (locationParams.fromchange && !locationParams.tochange ||
                    locationParams.startdate && !locationParams.enddate) {

                    params.count = locationParams.nojobs ? MAX_RESULTSET_FETCH_SIZE_NOJOBS : MAX_RESULTSET_FETCH_SIZE;
                }

                locationParams = convertDates(locationParams);

                $log.debug("updated params", params);
                _.extend(params, locationParams);
            }

            if (resultsetlist) {
                _.extend(params, {
                    offset: 0,
                    count: resultsetlist.length,
                    id__in: resultsetlist.join()
                });
            }
            return $http.get(
                thUrl.getProjectUrl("/resultset/", repoName),
                {params: params}
            );
        },
        get: function(uri) {
            return $http.get(thServiceDomain + uri);
        },
        getResultSetJobsUpdates: function(resultSetIdList, repoName, exclusionProfile, lastModified){
            if(angular.isDate(lastModified)){
                lastModified = lastModified.toISOString().replace("Z","");
            }
            var params = {
                result_set_id__in: resultSetIdList.join(","),
                count: 2000,
                last_modified__gt: lastModified,
                return_type: "list"
            };
            if(exclusionProfile){
                params.exclusion_profile = exclusionProfile;
            }
            return ThJobModel.get_list(repoName, params, {fetch_all: true});
        },

        getResultSetJobs: function(resultSets, repoName, exclusionProfile){
            var jobsPromiseList = [];
            _.each(
                resultSets.results,
                function(rs, index){
                    var params = {
                        return_type: "list",
                        result_set_id:rs.id,
                        count: 2000
                    };
                    if(exclusionProfile){
                        params.exclusion_profile = exclusionProfile;
                    }
                    jobsPromiseList.push(ThJobModel.get_list(repoName, params, {fetch_all: true}));
                }
            );
            return jobsPromiseList;
        },

        getRevisions: function(projectName, resultSetId) {
            return $http.get(thUrl.getProjectUrl(
                "/resultset/" + resultSetId, projectName), {cache: true}).then(
                    function(response) {
                        if (response.data.revisions.length > 0) {
                            return _.map(response.data.revisions, function(r) {
                                return r.revision;
                            });
                        } else {
                          return $q.reject("No revisions found for result set " +
                                           resultSetId + " in project " + projectName);
                        }
                    });
        },

        getResultSetsFromRevision: function(projectName, revision) {
            return $http.get(thUrl.getProjectUrl(
                "/resultset/?revision=" + revision, projectName),
                             {cache: true}).then(
                    function(response) {
                        if (response.data.results.length > 0) {
                            return response.data.results;
                        } else {
                            return $q.reject('No results found for revision ' +
                                             revision + " on project " +
                                             projectName);
                        }
                    });
        },

        cancelAll: function(resultset_id, repoName) {
            var uri = resultset_id + '/cancel_all/';
            return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
        }
    };
}]);
