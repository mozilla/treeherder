'use strict';

/* Services */
treeherder.factory('thUrl',
                   ['$rootScope', 'thServiceDomain',
                   function($rootScope, thServiceDomain) {
    return {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getProjectUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repoName + uri;
        },
        getLogViewerUrl: function(artifactId) {
            return "logviewer.html#?id=" + artifactId + "&repo=" + $rootScope.repoName;
        },
        getSocketEventUrl: function() {
            var port = thServiceDomain.indexOf("https:") !== -1 ? 443 :80;
            return thServiceDomain + ':' + port + '/events';
        }
    };
    return thUrl;

}]);

treeherder.factory('thArtifact',
                   ['$http', 'thUrl',
                   function($http, thUrl) {

    // get the artifacts for this tree
    return {
        getArtifact: function(id) {
            return $http.get(thUrl.getProjectUrl(
                "/artifact/" + id + "/"));
        }
    }
}]);

treeherder.factory('thJobs',
                   ['$http', 'thUrl',
                   function($http, thUrl) {

    return {
        getJobs: function(offset, count, joblist) {
            offset = typeof offset == 'undefined'?  0: offset;
            count = typeof count == 'undefined'?  10: count;
            var params = {
                offset: offset,
                count: count,
                format: "json"
            }

            if (joblist) {
                _.extend(params, {
                    offset: 0,
                    count: joblist.length,
                    id__in: joblist.join()
                })
            }
            return $http.get(thUrl.getProjectUrl("/jobs/"),
                             {params: params}
            );
        }
    }
}]);

treeherder.factory('thJobNote', function($resource, $http, thUrl) {
    return {
        get: function() {
            var JobNote = $resource(thUrl.getProjectUrl("/note/"));
            // Workaround to the fact that $resource strips trailing slashes
            // out of urls.  This causes a 301 redirect on POST because it does a
            // preflight OPTIONS call.  Tastypie gives up on the POST after this
            // and nothing happens.  So this alternative "thSave" command avoids
            // that by using the trailing slash directly in a POST call.
            // @@@ This may be fixed in later versions of Angular.  Or perhaps there's
            // a better way?
            JobNote.prototype.thSave = function() {
                $http.post(thUrl.getProjectUrl("/note/"), {
                    job_id: this.job_id,
                    note: this.note,
                    who: this.who,
                    failure_classification_id: this.failure_classification_id
                });
            };
            return JobNote;
        }
    };
});


treeherder.factory('thSocket', function ($rootScope, $log, thUrl) {
    var socket = io.connect(thUrl.getSocketEventUrl());
    socket.on('connect', function(){
       $log.debug('socketio connected');
    });
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      });
    }
  };
});

treeherder.factory('BrowserId', function($http, $q, $log,  thServiceDomain){
    var browserid = {
        info: $http.get(thServiceDomain+'/browserid/info/'),
        requestDeferred: null,
        logoutDeferred: null,
        login: function(requestArgs){
            return browserid.getAssertion(requestArgs)
            .then(function(response) {
                return browserid.verifyAssertion(response);
            });

        },
        logout: function(){
            return browserid.info.then(function(response){
                browserid.logoutDeferred = $q.defer();
                navigator.id.logout();
                return browserid.logoutDeferred.promise.then(function(){
                    return $http.post(response.data.logoutUrl);
                })
            });


        },
        getAssertion: function(requestArgs){
            return browserid.info.then(function(response){
                requestArgs = _.extend({}, response.data.requestArgs, requestArgs);
                browserid.requestDeferred = $q.defer();
                navigator.id.request(requestArgs);
                return browserid.requestDeferred.promise;
           });
        },
        verifyAssertion: function(assertion){
            return browserid.info.then(function(response){
                return $http.post(
                    response.data.loginUrl, {assertion: assertion},{
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
                        transformRequest: browserid.transform_data
                    });
            });
        },
        transform_data: function(data){
            return $.param(data);
        }
    }
    return browserid;
});
