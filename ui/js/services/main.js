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

    var cloneHtmlObjs = {};
    var templateId = "";
    var templateName = "";
    var templateTxt = "";

    var i=0;
    for(; i<cloneTemplateIds.length; i++){

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

treeherder.factory('thPlatformElements', function($rootScope) {

    var getPlatformRowId = function(
        resultsetId, platformName, platformOptions){
        return $rootScope.repoName +
                resultsetId +
                platformName +
                platformOptions;
    };

    var getPlatformRowElement = function(
        resultsetId, platformName, platformOptions){
        return document.getElementById(
            getPlatformRowId(resultsetId, platformName, platformOptions)
            );
    };

    return {
        getPlatformRowId:getPlatformRowId,
        getPlatformRowElement:getPlatformRowElement
        };
});
