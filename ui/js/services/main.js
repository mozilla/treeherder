'use strict';

/* Services */
treeherder.factory('thUrl',['$rootScope', 'thServiceDomain', 'ThLog', function($rootScope, thServiceDomain, ThLog) {

   var thUrl =  {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getProjectUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repoName + uri;
        },
        getLogViewerUrl: function(job_id) {
            return "logviewer.html#?job_id=" + job_id + "&repo=" + $rootScope.repoName;
        },
        getSocketEventUrl: function() {
            var port = thServiceDomain.indexOf("https:") !== -1 ? 443 :80;
            return thServiceDomain + ':' + port + '/events';
        }
   };
   return thUrl;

}]);

treeherder.factory('thSocket', function ($rootScope, ThLog, thUrl) {
    var $log = new ThLog("thSocket");

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

treeherder.factory('ThPaginator', function(){
    //dead-simple implementation of an in-memory paginator

    var ThPaginator = function(data, limit){
        this.data = data;
        this.length = data.length;
        this.limit = limit;
    };

    ThPaginator.prototype.get_page = function(n){
        return this.data.slice(n * limit - limit, n * limit);
    }

    ThPaginator.prototype.get_all = function(){
        return data
    };

    return ThPaginator

});

treeherder.factory('BrowserId', function($http, $q, ThLog,  thServiceDomain){

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

treeherder.factory('thNotify', function($timeout, ThLog){
    //a growl-like notification system

    var $log = new ThLog("thNotify");

    var thNotify =  {
        // message queue
        notifications: [],

        /*
        * send a message to the notification queue
        * @severity can be one of success|info|warning|danger
        * @sticky is a boolean indicating if you want the message to disappear
        * after a while or not
        */
        send: function(message, severity, sticky){
            $log.debug("received message", message);
            var severity = severity || 'info';
            var sticky = sticky || false;
            thNotify.notifications.push({
                message: message,
                severity: severity,
                sticky: sticky
            });
            if(!sticky){
                $timeout(thNotify.shift, 5000, true);
            }
        },

        /*
        * Delete the first non-sticky element from the notifications queue
        */
        shift: function(){
            for(var i=0;i<thNotify.notifications.length; i++){
                if(!thNotify.notifications[i].sticky){
                    thNotify.remove(i);
                    return;
                }
            }
        },
        /*
        * remove an arbitrary element from the notifications queue
        */
        remove: function(index){
            thNotify.notifications.splice(index, 1)
        }
    }
    return thNotify;

});
