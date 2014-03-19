"use strict";

treeherder.provider('thServiceDomain', function() {
    this.$get = function() {
        if (window.thServiceDomain) {
            return window.thServiceDomain;
        } else {
            return "";
        }
    };
});

treeherder.provider('thResultStatusList', function() {
    this.$get = function() {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'running', 'pending'];
    };
});

treeherder.provider('thResultStatus', function() {
    this.$get = function() {
        return function(job) {
            var rs = job.result;
            if (job.state !== "completed") {
                rs = job.state;
            }
            return rs;
        };
    };
});

treeherder.provider('thResultStatusObject', function() {
    var getResultStatusObject = function(){
        return {
            'success':0,
            'testfailed':0,
            'busted':0,
            'exception':0,
            'retry':0,
            'running':0,
            'pending':0
            };
    };

    this.$get = function() {
        return {
            getResultStatusObject:getResultStatusObject
            };
    };
});

treeherder.provider('thResultStatusInfo', function() {
    this.$get = function() {
        return function(resultState) {
            // default if there is no match, used for pending
            var resultStatusInfo = {
                severity: 100,
                isCollapsedResults: true,
                btnClass: "btn-default",
                showButtonIcon: "glyphicon glyphicon-time",
                jobButtonIcon: ""
            };

            switch (resultState) {
                case "busted":
                    resultStatusInfo = {
                        severity: 1,
                        isCollapsedResults: false,
                        btnClass: "btn-red",
                        showButtonIcon: "glyphicon glyphicon-fire",
                        jobButtonIcon: "glyphicon glyphicon-fire",
                        countText: "busted"
                    };
                    break;
                case "exception":
                    resultStatusInfo = {
                        severity: 2,
                        isCollapsedResults: false,
                        btnClass: "btn-purple",
                        showButtonIcon: "glyphicon glyphicon-fire",
                        jobButtonIcon: "glyphicon glyphicon-fire",
                        countText: "exception"
                    };
                    break;
                case "testfailed":
                    resultStatusInfo = {
                        severity: 3,
                        isCollapsedResults: false,
                        btnClass: "btn-orange",
                        showButtonIcon: "glyphicon glyphicon-warning-sign",
                        jobButtonIcon: "glyphicon glyphicon-warning-sign",
                        countText: "failed"
                    };
                    break;
                case "unknown":
                    resultStatusInfo = {
                        severity: 4,
                        isCollapsedResults: false,
                        btnClass: "btn-black",
                        showButtonIcon: "glyphicon glyphicon-warning-sign",
                        jobButtonIcon: "",
                        countText: "unknown"
                    };
                    break;
                case "usercancel":
                    resultStatusInfo = {
                        severity: 5,
                        isCollapsedResults: true,
                        btnClass: "btn-pink",
                        showButtonIcon: "glyphicon glyphicon-stop",
                        jobButtonIcon: "",
                        countText: "cancel"
                    };
                    break;
                case "retry":
                    resultStatusInfo = {
                        severity: 6,
                        isCollapsedResults: true,
                        btnClass: "btn-dkblue",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: "",
                        countText: "retry"
                    };
                    break;
                case "success":
                    resultStatusInfo = {
                        severity: 7,
                        isCollapsedResults: true,
                        btnClass: "btn-green",
                        showButtonIcon: "glyphicon glyphicon-ok",
                        jobButtonIcon: "",
                        countText: "success"
                    };
                    break;
                case "running":
                    resultStatusInfo = {
                        severity: 8,
                        isCollapsedResults: true,
                        btnClass: "btn-dkgray",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: "",
                        countText: "running"
                    };
                    break;
                case "pending":
                    resultStatusInfo = {
                        severity: 100,
                        isCollapsedResults: true,
                        btnClass: "btn-ltgray",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: "",
                        countText: "pending"
                    };
                    break;
            }

            return resultStatusInfo;
        };

    };
});

/**
 * The set of custom Treeherder events.
 *
 * These are/can be used via $rootScope.$broadcast.
 */
treeherder.provider('thEvents', function() {
    this.$get = function() {
        return {

            // fired when a list of revisions has been loaded by button-click
            revisionsLoaded: "revisions-loaded-EVT",

            // fired (surprisingly) when a job is clicked
            jobClick: "job-click-EVT",

            // fired when the job details are loaded
            jobDetailLoaded: "job-detail-loaded-EVT",

            // fired when a job is shift-clicked
            jobPin: "job-pin-EVT",

            // fired when the user middle-clicks on a job to view the log
            jobContextMenu: "job-context-menu-EVT",

            // fired when jobs are either classified locally, or we are
            // notified about a classification over socket.io
            jobsClassified: "jobs-classified-EVT",

            // fired when bugs are associated to jobs locally, or we are
            // notified about a bug association over socket.io
            bugsAssociated: "bugs-associated-EVT",

            // after loading a group of jobs queued during socket.io events
            jobsLoaded: "jobs-loaded-EVT",

            // fired when a global filter has changed
            globalFilterChanged: "status-filter-changed-EVT",

            // fired when filtering on a specific resultset has changed
            resultSetFilterChanged: "resultset-filter-changed-EVT",

            toggleRevisions: "toggle-revisions-EVT",

            toggleJobs: "toggle-jobs-EVT",

            searchPage: "search-page-EVT",

            repoChanged: "repo-changed-EVT",

            // this is a call to re-check how much padding we need at the top
            // of the main content window.  If the width of the browser changes
            // or the number of watched repos changes, this could change the
            // height of the top navbar and require more top-padding to be able
            // to view the main content window.
            topNavBarContentChanged: "top-navbar-height-changed-EVT"
        };
    };
});

treeherder.provider('thAggregateIds', function() {
    var getPlatformRowId = function(
        repoName, resultsetId, platformName, platformOptions){
        return  repoName +
                resultsetId +
                platformName +
                platformOptions;
    };

    var getResultsetTableId = function(repoName, resultsetId, revision){
        return repoName + resultsetId + revision;
    };

    this.$get = function() {
        return {
            getPlatformRowId:getPlatformRowId,
            getResultsetTableId:getResultsetTableId
            };
    };
});
