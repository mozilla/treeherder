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
    var all = function() {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'usercancel', 'running', 'pending', 'coalesced', 'runnable'];
    };

    var defaultFilters = function() {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'usercancel', 'running', 'pending', 'runnable'];
    };

    this.$get = function() {
        return {
            all: all,
            defaultFilters: defaultFilters
        };
    };
});

treeherder.provider('thResultStatus', function() {
    this.$get = function() {
        return function(job) {
            if (job.state === "completed") {
                return job.result;
            }
            // Coalesced jobs are marked as pending by the API, this will be fixed by bug 1132546.
            if (job.job_coalesced_to_guid !== null) {
                return 'coalesced';
            }
            return job.state;
        };
    };
});

treeherder.provider('thResultStatusObject', function() {
    var getResultStatusObject = function(){
        return {
            'running':0,
            'pending':0,
            'completed':0
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
        return function(resultState, failure_classification_id) {
            // default if there is no match, used for pending
            var resultStatusInfo = {
                btnClass: "btn-default"
            };

            switch (resultState) {
                case "busted":
                case "failures":
                    resultStatusInfo = {
                        btnClass: "btn-red",
                        countText: "busted"
                    };
                    break;
                case "exception":
                    resultStatusInfo = {
                        btnClass: "btn-purple",
                        countText: "exception"
                    };
                    break;
                case "testfailed":
                    resultStatusInfo = {
                        btnClass: "btn-orange",
                        countText: "failed"
                    };
                    break;
                case "unknown":
                    resultStatusInfo = {
                        btnClass: "btn-yellow",
                        countText: "unknown"
                    };
                    break;
                case "usercancel":
                    resultStatusInfo = {
                        btnClass: "btn-pink",
                        countText: "cancel"
                    };
                    break;
                case "retry":
                    resultStatusInfo = {
                        btnClass: "btn-dkblue",
                        countText: "retry"
                    };
                    break;
                case "success":
                    resultStatusInfo = {
                        btnClass: "btn-green",
                        countText: "success"
                    };
                    break;
                case "running":
                case "in progress":
                    resultStatusInfo = {
                        btnClass: "btn-dkgray",
                        countText: "running"
                    };
                    break;
                case "pending":
                    resultStatusInfo = {
                        btnClass: "btn-ltgray",
                        countText: "pending"
                    };
                    break;
                case "coalesced":
                    resultStatusInfo = {
                        btnClass: "btn-ltblue",
                        countText: "coalesced"
                    };
                    break;
            }

            // handle if a job is classified
            if (parseInt(failure_classification_id, 10) > 1) {
                resultStatusInfo.btnClass = resultStatusInfo.btnClass + "-classified";
                resultStatusInfo.countText = "classified " + resultStatusInfo.countText;
            }
            return resultStatusInfo;
        };

    };
});

/**
 * The set of custom Treeherder events.
 *
 * These are/can be used via $rootScope.$emit.
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

            // fired with a selected job on ctrl/cmd-click or spacebar
            jobPin: "job-pin-EVT",

            // fired with a selected job on 'r'
            jobRetrigger: "job-retrigger-EVT",

            // fired when the user middle-clicks on a job to view the log
            jobContextMenu: "job-context-menu-EVT",

            // fired when jobs are classified locally
            jobsClassified: "jobs-classified-EVT",

            // fired when bugs are associated to jobs locally
            bugsAssociated: "bugs-associated-EVT",

            // after loading a group of jobs
            jobsLoaded: "jobs-loaded-EVT",

            // after deselecting a job via click outside/esc
            clearSelectedJob: "clear-selected-job-EVT",

            // fired when a global filter has changed
            globalFilterChanged: "status-filter-changed-EVT",

            // after something happened that requires the number
            // of unclassified jobs by tier to be recalculated
            recalculateUnclassified: "recalc-unclassified-EVT",

            groupStateChanged: "group-state-changed-EVT",

            toggleRevisions: "toggle-revisions-EVT",

            showRunnableJobs: "show-runnable-jobs-EVT",

            deleteRunnableJobs: "delete-runnable-jobs-EVT",

            toggleAllRevisions: "toggle-all-revisions-EVT",

            toggleUnclassifiedFailures: "toggle-unclassified-failures-EVT",

            changeSelection: "next-previous-job-EVT",

            addRelatedBug: "add-related-bug-EVT",

            saveClassification: "save-classification-EVT",

            deleteClassification: "delete-classification-EVT",

            clearPinboard: "clear-pinboard-EVT",

            searchPage: "search-page-EVT",

            selectJob: "select-job-EVT",

            mapResultSetJobs: "map-result-set-jobs-EVT",

            applyNewJobs: "apply-new-jobs-EVT",

            initSheriffPanel: "init-sheriff-panel-EVT",

            openLogviewer: "open-logviewer-EVT"
        };
    };
});

treeherder.provider('thAggregateIds', function() {

    var escape = function(id) {
        return id.replace(/(:|\[|\]|\?|,|\.|\s+)/g, '-');
    };

    var getPlatformRowId = function(
        repoName, resultsetId, platformName, platformOptions) {
        // ensure there are no invalid characters in the id (like spaces, etc)
        return escape(repoName +
                      resultsetId +
                      platformName +
                      platformOptions);
    };

    var getResultsetTableId = function(repoName, resultsetId, revision){
        return escape(repoName + resultsetId + revision);
    };

    var getGroupMapKey = function(result_set_id, grSymbol, plName, plOpt) {
        //Build string key for groupMap entires
        return escape(result_set_id + grSymbol + plName + plOpt);
    };

    var getJobMapKey = function(job) {
        //Build string key for jobMap entires
        return 'key' + job.id;
    };

    this.$get = function() {
        return {
            getPlatformRowId:getPlatformRowId,
            getResultsetTableId:getResultsetTableId,
            getJobMapKey: getJobMapKey,
            getGroupMapKey: getGroupMapKey,
            escape: escape
        };
    };
});

treeherder.provider('thReftestStatus', function() {
    this.$get = function() {
        return function(job) {
            if (job.job_group_name) {
                return (job.job_group_name.toLowerCase().indexOf('reftest') !== -1);
            }
        };
    };
});
