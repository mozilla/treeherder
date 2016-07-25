'use strict';

/* Services */
treeherder.factory('thUrl', [
    '$rootScope', 'thServiceDomain', 'ThLog',
    function($rootScope, thServiceDomain, ThLog) {

        var thUrl = {
            getRootUrl: function(uri) {
                return thServiceDomain + "/api" + uri;
            },
            getProjectUrl: function(uri, repoName) {
                if (_.isUndefined(repoName)) {
                    repoName = $rootScope.repoName;
                }
                return thServiceDomain + "/api/project/" + repoName + uri;
            },
            getProjectJobUrl: function(url, jobId, repoName) {
                var uri = "/jobs/" + jobId + url;
                return thUrl.getProjectUrl(uri, repoName);
            },
            getJobsUrl: function(repo, fromChange, toChange) {
                return "index.html#/jobs?" + _.reduce({
                    repo: repo, fromchange: fromChange, tochange: toChange
                }, function(result, v, k) {
                    if (result.length)
                        result += '&';
                    return result + k + '=' + v;
                }, "");
            },
            getLogViewerUrl: function(job_id) {
                return "logviewer.html#?job_id=" + job_id + "&repo=" + $rootScope.repoName;
            },
            getBugUrl: function(bug_id) {
                return "https://bugzilla.mozilla.org/show_bug.cgi?id=" + bug_id;
            },
            getSlaveHealthUrl: function(machine_name) {
                return "https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=" + machine_name;
            }
        };
        return thUrl;

    }]);

treeherder.factory('thCloneHtml', [
    '$interpolate',
    function($interpolate) {

        var cloneTemplateIds = [
            'revisionsClone.html',
            'resultsetClone.html',
            'platformClone.html',
            'jobTdClone.html',
            'jobGroupClone.html',
            'jobGroupCountClone.html',
            'jobBtnClone.html',
            'runnableJobBtnClone.html',
            'pushlogRevisionsClone.html'
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

    }]);

treeherder.factory('ThPaginator', function(){
    //dead-simple implementation of an in-memory paginator

    var ThPaginator = function(data, limit){
        this.data = data;
        this.length = data.length;
        this.limit = limit;
    };

    ThPaginator.prototype.get_page = function(n){
        return this.data.slice(n * limit - limit, n * limit);
    };

    ThPaginator.prototype.get_all = function(){
        return data;
    };

    return ThPaginator;

});

treeherder.factory('BrowserId', [
    '$http', '$q', 'ThLog', 'thServiceDomain',
    function($http, $q, ThLog, thServiceDomain){

        /*
         * BrowserId is a wrapper for the persona authentication service
         * it handles the navigator.id.request and navigator.id.logout calls
         * and exposes the related promises via requestDeferred and logoutDeferred.
         * This is mostly inspired by the django_browserid jquery implementation.
         */
        var browserid = {
            requestDeferred: null,
            logoutDeferred: null,

            /*
             * Retrieve an assertion from the persona service and
             * and send it to the treeherder verification endpoints.
             *
             */
            login: function(){
                return browserid.getAssertion()
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
                browserid.logoutDeferred = $q.defer();
                navigator.id.logout();
                return browserid.logoutDeferred.promise.then(function(){
                    return $http.post(thServiceDomain+'/browserid/logout/');
                });
            },
            /*
             * Ask persona to provide an assetion and return a promise of the response
             * The requestDeferred promise is resolved by the onLogin callback
             * of navigator.id.watch.
             */
            getAssertion: function(){
                browserid.requestDeferred = $q.defer();
                navigator.id.request();
                return browserid.requestDeferred.promise;
            },
            /*
             * Verify the assertion provided by persona against the treeherder verification endpoint.
             * The django_browserid endpoint accept a post request with form-urlencoded fields.
             */
            verifyAssertion: function(assertion){
                return $http.post(
                    thServiceDomain+'/browserid/login/',
                    {assertion: assertion},
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
                        transformRequest: browserid.transform_data
                    }
                );
            },

            transform_data: function(data){
                return $.param(data);
            }
        };
        return browserid;
    }]);

treeherder.factory('thNotify', [
    '$timeout', 'ThLog',
    function($timeout, ThLog){
        //a growl-like notification system

        var $log = new ThLog("thNotify");

        var thNotify = {
            // message queue
            notifications: [],

            /*
             * send a message to the notification queue
             * @severity can be one of success|info|warning|danger
             * @sticky is a boolean indicating if you want the message to disappear
             * after a while or not
             */
            send: function(message, severity, sticky, linkText, url) {
                $log.debug("received message", message);
                severity = severity || 'info';
                sticky = sticky || false;
                var maxNsNotifications = 5;
                thNotify.notifications.push({
                    message: message,
                    severity: severity,
                    sticky: sticky,
                    linkText: linkText,
                    url: url
                });

                if (!sticky) {
                    if (thNotify.notifications.length > maxNsNotifications) {
                        $timeout(thNotify.shift);
                        return;
                    }
                    $timeout(thNotify.shift, 4000, true);
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
                thNotify.notifications.splice(index, 1);
            }
        };
        return thNotify;

    }]);

treeherder.factory('thPlatformName', [
    'thPlatformNameMap',
    function(thPlatformNameMap) {

        return function(name) {
            return thPlatformNameMap[name] || name;
        };
    }]);

treeherder.factory('thExtendProperties', [
    /* Version of _.extend that works with property descriptors */
    function() {
        return function(dest, src) {
            if (dest !== src) {
                for (var key in src) {
                    if (!src.hasOwnProperty(key)) {
                        continue;
                    }
                    var descriptor = Object.getOwnPropertyDescriptor(src, key);
                    if (descriptor && descriptor.get) {
                        Object.defineProperty(dest, key,
                                              {get: descriptor.get,
                                               set: descriptor.set,
                                               enumerable: descriptor.enumerable,
                                               configurable: descriptor.configurable});
                    } else {
                        dest[key] = src[key];
                    }
                }
            }
            return dest;
        };
    }]);
