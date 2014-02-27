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
    socket.on('connect', function () {
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

treeherder.factory('thCloneHtml', function($interpolate) {

    var cloneTemplateIds = [
        'revisionsClone.html',
        'resultsetClone.html',
        'platformClone.html',
        'jobTdClone.html',
        'jobGroupBeginClone.html',
        'jobGroupEndClone.html',
        'jobBtnClone.html'
        ];

    var templateId, templateName, templateTxt, i;

    var cloneHtmlObjs = {};
    for(i=0; i<cloneTemplateIds.length; i++){

        templateId = cloneTemplateIds[i];
        templateName = templateId.replace('.html', '');

        templateTxt = document.getElementById(templateId);
        cloneHtmlObjs[templateName] = {
            interpolator:$interpolate(templateTxt.text),
            text:templateTxt.text
            };
    }

    var getClone = function(templateName){
        return cloneHtmlObjs[templateName];
    };

    return {
        get:getClone
        };

});

treeherder.factory('BrowserId', function($http, $q, $log,  thServiceDomain){
    
    /* 
    * BrowserId is a wrapper for the persona authentication service
    * it handles the navigator.id.request and navigator.id.logout calls
    * and exposes the related promises via requestDeferred and logoutDeferred.
    * This is mostly inspired by the django_browserid jquery implementation.  
    */
    var browserid = {
        info: $http.get(thServiceDomain+'/browserid/info/'),
        requestDeferred: null,
        logoutDeferred: null,
        
        /*
        * Retrieve an assertion from the persona service and 
        * and send it to the treeherder verification endpoints.
        * 
        */
        login: function(requestArgs){
            return browserid.getAssertion(requestArgs)
            .then(function(response) {
                return browserid.verifyAssertion(response);
            });

        },
        /*
        * Logout from persona and notify treeherder of the change
        * The logoutDeferred promise is resolved by the onLogout callback
        * of navigator.id.watch
        */
        logout: function(){
            return browserid.info.then(function(response){
                browserid.logoutDeferred = $q.defer();
                navigator.id.logout();
                return browserid.logoutDeferred.promise.then(function(){
                    return $http.post(response.data.logoutUrl);
                })
            });
        },
        /*
        * Ask persona to provide an assetion and return a promise of the response
        * The requestDeferred promise is resolved by the onLogin callback
        * of navigator.id.watch. 
        */
        getAssertion: function(requestArgs){
            return browserid.info.then(function(response){
                requestArgs = _.extend({}, response.data.requestArgs, requestArgs);
                browserid.requestDeferred = $q.defer();
                navigator.id.request(requestArgs);
                return browserid.requestDeferred.promise;
           });
        },
        /*
        * Verify the assertion provided by persona against the treeherder verification endpoint.
        * The django_browserid endpoint accept a post request with form-urlencoded fields. 
        */
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
