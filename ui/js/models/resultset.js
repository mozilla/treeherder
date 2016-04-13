'use strict';

treeherder.factory(
    'ThResultSetModel',
    ['$rootScope', '$http', '$location', '$q', 'thUrl', 'thResultStatusObject',
     'thEvents', 'thServiceDomain', 'ThLog', 'thNotify','ThJobModel',
     'thPlatformOrder', 'thOptionOrder',
     function($rootScope, $http, $location, $q, thUrl, thResultStatusObject, thEvents, thServiceDomain,
              ThLog, thNotify, ThJobModel, thPlatformOrder, thOptionOrder) {

         var $log = new ThLog("ThResultSetModel");

         var MAX_RESULTSET_FETCH_SIZE = 100;

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

         // return whether an OLDEST resultset range is set.
         var hasLowerRange = function (locationParams) {
             return locationParams.fromchange || locationParams.startdate;
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

             getResultSets: function(repoName, rsOffsetTimestamp, count, full, keep_filters) {
                 rsOffsetTimestamp = typeof rsOffsetTimestamp === 'undefined'?  0: rsOffsetTimestamp;
                 full = _.isUndefined(full) ? true: full;
                 keep_filters = _.isUndefined(keep_filters) ? true : keep_filters;

                 var params = {
                     full: full
                 };

                 // count defaults to 10, but can be no larger than the max.
                 params.count = !count ? 10 : Math.min(count, MAX_RESULTSET_FETCH_SIZE);

                 if(rsOffsetTimestamp){
                     params.push_timestamp__lte = rsOffsetTimestamp;
                     // we will likely re-fetch the oldest we already have, but
                     // that's not guaranteed.  There COULD be two resultsets
                     // with the same timestamp, theoretically.
                     params.count++;
                 }

                 if (keep_filters) {
                     // if there are any search params on the url line, they should
                     // pass directly to the set of resultsets.
                     // with the exception of ``repo``.  That has no effect on the
                     // service at this time, but it could be confusing.
                     var locationParams = _.clone($location.search());
                     delete locationParams.repo;

                     // if they submit an offset timestamp, then they have resultsets
                     // and are fetching more.  So don't honor the fromchange/tochange
                     // or else we won't be able to fetch more resultsets.

                     // we DID already check for rsOffsetTimestamp above, but that was
                     // not within the ``keep_filters`` check.  If we don't
                     // keep filters, we don't need to clone the $location.search().
                     if (rsOffsetTimestamp) {
                         delete locationParams.tochange;
                         delete locationParams.fromchange;
                     } else if (hasLowerRange(locationParams)) {
                         // fetch the maximum number of resultsets if a lower range is specified
                         params.count = MAX_RESULTSET_FETCH_SIZE;
                     }

                     locationParams = convertDates(locationParams);

                     $log.debug("updated params", params);
                     _.extend(params, locationParams);
                 }

                 return $http.get(
                     thUrl.getProjectUrl("/resultset/", repoName),
                     {params: params}
                 );
             },
             getResultSetList: function(repoName, resultSetList, full) {
                 return $http.get(
                     thUrl.getProjectUrl("/resultset/", repoName), {
                         params: {
                             full: _.isUndefined(full) ? true: full,
                             offset: 0,
                             count: resultSetList.length,
                             id__in: resultSetList.join()
                         }
                     });
             },
             getResultSet: function(repoName, pk) {
                 return $http.get(
                     thUrl.getProjectUrl("/resultset/"+pk+"/", repoName)
                 );
             },
             get: function(uri) {
                 return $http.get(thServiceDomain + uri);
             },
             getResultSetJobsUpdates: function(resultSetIdList, repoName, lastModified, locationParams){
                 if(angular.isDate(lastModified)){
                     lastModified = lastModified.toISOString().replace("Z","");
                 }
                 var params = {
                     result_set_id__in: resultSetIdList.join(","),
                     count: 2000,
                     last_modified__gt: lastModified,
                     return_type: "list"
                 };
                 _.extend(params, locationParams);
                 return ThJobModel.get_list(repoName, params, {fetch_all: true});
             },

             getResultSetJobs: function(resultSets, repoName, locationParams){
                 var jobsPromiseList = [];
                 _.each(
                     resultSets.results,
                     function(rs, index){
                         var params = {
                             return_type: "list",
                             result_set_id:rs.id,
                             count: 2000
                         };
                         _.extend(params, locationParams);
                         jobsPromiseList.push(ThJobModel.get_list(repoName, params, {fetch_all: true}));
                     }
                 );
                 return jobsPromiseList;
             },


             getRevisions: function(projectName, resultSetId) {
                 return $http.get(thUrl.getProjectUrl(
                     "/resultset/" + resultSetId + "/", projectName), {cache: true}).then(
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
             },

             triggerMissingJobs: function(resultset_id, repoName) {
                 var uri = resultset_id + '/trigger_missing_jobs/';
                 return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
             },

             triggerAllTalosJobs: function(resultset_id, repoName, times) {
                 var uri = resultset_id + '/trigger_all_talos_jobs/?times=' + times;
                 return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
             },

             triggerNewJobs: function(repoName, resultset_id, buildernames) {
                 var uri = resultset_id + '/trigger_runnable_jobs/';
                 var data = {buildernames: buildernames};
                 return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri, data);
             }
         };
     }]);
