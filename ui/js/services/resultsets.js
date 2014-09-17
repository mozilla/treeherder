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
        getResultSetsFromChange: function(repoName, revision){
            return $http.get(
                thUrl.getProjectUrl("/resultset/", repoName),
                {
                    params: {
                        fromchange:revision,
                        format:'json',
                        with_jobs:false
                    }
                }
            );
        },
        getResultSets: function(repoName, rsOffsetId, count, resultsetlist, with_jobs, full, keep_filters) {
            rsOffsetId = typeof rsOffsetId === 'undefined'?  0: rsOffsetId;
            count = typeof count === 'undefined'?  10: count;
            with_jobs = _.isUndefined(with_jobs) ? true: with_jobs;
            full = _.isUndefined(full) ? true: full;
            keep_filters = _.isUndefined(keep_filters) ? true : false;

            var params = {
                full: full,
                format: "json",
                with_jobs: with_jobs
            };

            if (count > 0) {
                params.count = count;
            }

            if(rsOffsetId > 0){
                params.id__lt = rsOffsetId;
            }

            if(keep_filters){
                // if there are any search params on the url line, they should
                // pass directly to the set of resultsets.
                // with the exception of ``repo``.  That has no effect on the
                // service at this time, but it could be confusing.
                var locationParams = _.clone($location.search());
                delete locationParams.repo;

                // support date ranges.  we must convert the strings to a timezone
                // appropriate timestamp
                $log.debug("locationParams", locationParams);
                if (_.has(locationParams, "startdate")) {
                    params.push_timestamp__gte = Date.parse(
                        locationParams.startdate)/1000;

                    delete locationParams.startdate;
                }
                if (_.has(locationParams, "enddate")) {
                    params.push_timestamp__lt = Date.parse(
                        locationParams.enddate)/1000 + 84600;

                    delete locationParams.enddate;
                }

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
        getResultSetJobs: function(resultSets, repoName){

            var uri = '1/get_resultset_jobs/';
            var fullUrl = thUrl.getProjectUrl("/resultset/", repoName) + uri;

            _.each(
                resultSets.results,
                function(rs, index){

                    return $http.get(
                        fullUrl, {
                            params: {
                                format: "json",
                                result_set_ids:rs.id
                            },
                            transformResponse:resultSetResponseTransformer
                        }
                    ).then( function(response){
                        if(response.status === 200){

                            if(response.data.results.length > 0){

                                $rootScope.$broadcast(
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
