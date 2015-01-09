/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';


treeherder.factory('thResultSets', [
    '$rootScope', '$http', '$location', '$q', 'thUrl', 'thEvents', 'thServiceDomain', 'ThLog', 'thNotify',
    function($rootScope, $http, $location, $q, thUrl, thEvents, thServiceDomain, ThLog, thNotify) {

    var getJobObj = function(job, jobPropertyNames){
        //Map the job property names to their corresponding
        //values in a job object
        var jobObj = {};
        var j = 0;
        for(; j < jobPropertyNames.length; j++){
            jobObj[ jobPropertyNames[j] ] = job[j];
        }
        return jobObj;
    };

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

    // Convert jobs value array into into an associative array
    // with property names
    var resultSetResponseTransformer = function(data, headersGetter){

        var responseData = angular.fromJson(data);
        var r = 0;
        for(; r<responseData.results.length; r++){

            if(responseData.results[r].platforms === undefined){
                continue;
            }

            var p = 0;
            for(; p < responseData.results[r].platforms.length; p++){
                var g = 0;
                for(; g < responseData.results[r].platforms[p].groups.length; g++){
                    var j = 0;
                    for(; j < responseData.results[r].platforms[p].groups[g].jobs.length; j++){

                        responseData.results[r].platforms[p].groups[g].jobs[j] = getJobObj(
                                responseData.results[r].platforms[p].groups[g].jobs[j],
                                responseData.job_property_names
                            );
                    }
                }
            }
        }

        return responseData;
    };

    var $log = new ThLog("thResultSets");

    // get the resultsets for this repo
    return {
        // used for polling new resultsets after initial load
        getResultSetsFromChange: function(repoName, revision, locationParams) {
            locationParams = convertDates(locationParams);
            _.extend(locationParams, {
                fromchange:revision,
                format:'json',
                with_jobs:false
            });

            return $http.get(
                thUrl.getProjectUrl("/resultset/", repoName),
                {params: locationParams}
            );
        },
        getResultSets: function(repoName, rsOffsetTimestamp, count, resultsetlist, with_jobs, full, keep_filters) {
            rsOffsetTimestamp = typeof rsOffsetTimestamp === 'undefined'?  0: rsOffsetTimestamp;
            count = typeof count === 'undefined'?  10: count;
            with_jobs = _.isUndefined(with_jobs) ? true: with_jobs;
            full = _.isUndefined(full) ? true: full;
            keep_filters = _.isUndefined(keep_filters) ? true : keep_filters;

            var params = {
                full: full,
                format: "json",
                with_jobs: with_jobs
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
                {
                    params: params,
                    transformResponse:resultSetResponseTransformer
                }
            );
        },
        get: function(uri) {
            return $http.get(thServiceDomain + uri, {params: {format: "json"}});
        },
        getResultSetJobs: function(resultSets, repoName, exclusion_state){

            var uri = '1/get_resultset_jobs/';
            var fullUrl = thUrl.getProjectUrl("/resultset/", repoName) + uri;

            _.each(
                resultSets.results,
                function(rs, index){
                    var params = {
                        format: "json",
                        result_set_ids:rs.id
                    };
                    if (exclusion_state) {
                        params.exclusion_state = exclusion_state;
                    }

                    return $http.get(
                        fullUrl, {
                            params: params,
                            transformResponse:resultSetResponseTransformer
                        }
                    ).then( function(response){
                        if(response.status === 200){

                            if(response.data.results.length > 0){

                                $rootScope.$emit(
                                    thEvents.mapResultSetJobs,
                                    repoName,
                                    response.data.results[0]
                                    );
                            }

                        }else{
                            // Send notification with response.status to
                            // UI here
                            thNotify.send(
                                "Error retrieving job data! response status " + response.status,
                                "danger",
                                true);
                        }
                }); //Close then

            }); //Close each

        }, //Close getResultSetJobs
        cancelAll: function(resultset_id, repoName) {
            var uri = resultset_id + '/cancel_all/';
            return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
        }
    };
}]);
