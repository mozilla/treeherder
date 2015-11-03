'use strict';

treeherder.factory('ThJobModel', [
    '$http', 'ThLog', 'thUrl', '$q',
    function($http, ThLog, thUrl, $q) {
        // ThJobModel is the js counterpart of job

        var ThJobModel = function(data) {
            // creates a new instance of ThJobModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThJobModel.prototype.get_current_eta = function(){
            var timestampSeconds = new Date().getTime()/1000;
            return Math.round( ( timestampSeconds - (
                parseInt(this.submit_timestamp) + parseInt(this.running_eta) ) )/60 );
        };

        ThJobModel.prototype.get_typical_eta = function(){
            return Math.round(
                parseInt(this.running_eta) /60
            );
        };

        ThJobModel.get_uri = function(repoName){return thUrl.getProjectUrl("/jobs/", repoName);};

        ThJobModel.get_list = function(repoName, options, config) {
            // a static method to retrieve a list of ThJobModel
            config = config || {};
            var timeout = config.timeout || null;
            var fetch_all = config.fetch_all || false;
            // The `uri` config allows to fetch a list of jobs from an arbitrary
            // endpoint e.g. the similar jobs endpoint. It defaults to the job
            // list endpoint.
            var uri = config.uri || ThJobModel.get_uri(repoName);

            return $http.get(uri,{
                params: options,
                timeout: timeout
            }).
                then(function(response) {
                    var item_list;
                    var next_pages_jobs = [];
                    // if the number of elements returned equals the page size, fetch the next pages
                    if(fetch_all && (response.data.results.length === response.data.meta.count)) {
                        var current_offset = parseInt(response.data.meta.offset);
                        var page_size = parseInt(response.data.meta.count);
                        var new_options = angular.copy(options);
                        new_options.offset = page_size + current_offset;
                        new_options.count = page_size;
                        next_pages_jobs = ThJobModel.get_list(repoName, new_options, config);
                    }
                    if(_.has(response.data, 'job_property_names')){
                        // the results came as list of fields
                        //we need to convert them to objects
                        item_list = _.map(response.data.results, function(elem){
                            var job_obj = _.object(response.data.job_property_names, elem);
                            return new ThJobModel(job_obj);
                        });
                    }else{
                        item_list = _.map(response.data.results, function(job_obj){
                            return new ThJobModel(job_obj);
                        });
                    }
                    // next_pages_jobs is wrapped in a $q.when call because it could be
                    // either a promise or a value
                    return $q.when(next_pages_jobs).then(function(maybe_job_list){
                        return  item_list.concat(maybe_job_list);
                    });
                });
        };

        ThJobModel.get = function(repoName, pk, config) {
            // a static method to retrieve a single instance of ThJobModel
            config = config || {};
            var timeout = config.timeout || null;

            return $http.get(ThJobModel.get_uri(repoName)+pk+"/",
                             {timeout:timeout})
                .then(function(response) {
                    return new ThJobModel(response.data);
                });
        };

        ThJobModel.get_similar_jobs = function(repoName, pk, options, config){
            config = config || {};
            // The similar jobs endpoints returns the same type of objects as
            // the job list endpoint, so let's reuse the get_list method logic.
            config.uri = ThJobModel.get_uri(repoName)+pk+"/similar_jobs/";
            return ThJobModel.get_list(repoName, options, config);
        };

        ThJobModel.retrigger = function(repoName, job_id_list, config) {
            config = config || {};
            var timeout = config.timeout || null;

            return $http.post(ThJobModel.get_uri(repoName)+"retrigger/",
                              {job_id_list:job_id_list, timeout:timeout})
                .then(function(response) {
                    return new ThJobModel(response.data);
                });
        };

        ThJobModel.backfill = function(repoName, pk, config) {
            config = config || {};
            var timeout = config.timeout || null;

            return $http.post(ThJobModel.get_uri(repoName)+pk+"/backfill/",
                              {timeout:timeout});
        };

        ThJobModel.cancel = function(repoName, pk, config) {
            config = config || {};
            var timeout = config.timeout || null;

            return $http.post(ThJobModel.get_uri(repoName)+pk+"/cancel/",
                              {timeout:timeout})
                .then(function(response) {
                    return new ThJobModel(response.data);
                });
        };

        return ThJobModel;
    }]);
