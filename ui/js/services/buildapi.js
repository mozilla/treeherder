'use strict';

treeherder.factory('thBuildApi', [
    '$http', '$location', 'thUrl', 'thServiceDomain', 'ThLog', 'thNotify',
    function($http, $location, thUrl, thServiceDomain, ThLog, thNotify) {

        var $log = new ThLog("thBuildApi");
        var selfServeUrl = "https://secure.pub.build.mozilla.org/buildapi/self-serve/";

        var notify = function(status, action) {
            /*
              Use this logic if self-serve can return us a parse-able response.
              currently it comes back here with status 0 for success and error, so
              we can't tell if it worked or not.  So we just log the request as
              "sent" for now.
            */
            if (status === 0) {
                thNotify.send(action + " sent");
            } else if (status === 202 || status === 200) {
                thNotify.send(action + " SUCCESS");
            } else {
                thNotify.send(action + " FAILED " + status, "danger", true);
            }


        };

        return {
            retriggerJob: function(repoName, requestId) {

                return $http({
                    url: selfServeUrl + repoName + "/request",
                    method: "POST",
                    data: "request_id=" + requestId,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    withCredentials: true
                });
            },
            cancelJob: function(repoName, requestId) {
                return $http({
                    url: selfServeUrl + repoName + "/request/" + requestId,
                    method: "POST",
                    data: "_method=DELETE",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    withCredentials: true
                }).
                    success(function(data, status) {
                        notify(status, "cancel");
                    }).
                    error(function(data, status) {
                        notify(status, "cancel");
                    });
            },
            cancelAll: function(repoName, revision) {
                return $http({
                    url: selfServeUrl + repoName + "/rev/" + revision,
                    method: "POST",
                    data: "_method=DELETE",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    withCredentials: true

                }).
                    success(function(data, status) {
                        notify(status, "cancel all jobs");
                    }).
                    error(function(data, status) {
                        notify(status, "cancel all jobs");
                    });
            }
        };
    }]);
