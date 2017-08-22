import * as aggregateIds from '../job-view/aggregateIds';

treeherder.provider('thServiceDomain', function () {
    this.$get = function () {
        // The SERVICE_DOMAIN global is set by webpack's DefinePlugin.
        // return (typeof SERVICE_DOMAIN !== 'undefined') ? SERVICE_DOMAIN : "";
        return SERVICE_DOMAIN;
    };
});

treeherder.provider('thResultStatusList', function () {
    var all = function () {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'usercancel', 'running', 'pending', 'superseded', 'runnable'];
    };

    var defaultFilters = function () {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'usercancel', 'running', 'pending', 'runnable'];
    };

    this.$get = function () {
        return {
            all: all,
            defaultFilters: defaultFilters
        };
    };
});

treeherder.provider('thResultStatus', function () {
    this.$get = function () {
        return function (job) {
            if (job.state === "completed") {
                return job.result;
            }
            return job.state;
        };
    };
});

treeherder.provider('thResultStatusObject', function () {
    var getResultStatusObject = function () {
        return {
            running: 0,
            pending: 0,
            completed: 0
        };
    };

    this.$get = function () {
        return {
            getResultStatusObject: getResultStatusObject
        };
    };
});

treeherder.provider('thResultStatusInfo', function () {
    this.$get = function () {
        return function (resultState, failure_classification_id) {
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
                case "superseded":
                    resultStatusInfo = {
                        btnClass: "btn-ltblue",
                        countText: "superseded"
                    };
                    break;
            }

            // handle if a job is classified
            var classificationId = parseInt(failure_classification_id, 10);
            if (classificationId > 1) {
                resultStatusInfo.btnClass += "-classified";
                // autoclassification-only case
                if (classificationId === 7) {
                    resultStatusInfo.btnClass += " autoclassified";
                }
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
treeherder.provider('thEvents', function () {
    this.$get = function () {
        return {

            // fired when a list of revisions has been loaded by button-click
            revisionsLoaded: "revisions-loaded-EVT",

            // fired (surprisingly) when a job is clicked
            jobClick: "job-click-EVT",

            // fired when the job details are loaded
            jobDetailLoaded: "job-detail-loaded-EVT",

            // fired with a selected job on 't'
            selectNextTab: "select-next-tab-EVT",

            // fired with a selected job on spacebar
            jobPin: "job-pin-EVT",

            // fired with a selected job on ctrl/cmd-click
            toggleJobPin: "job-togglepin-EVT",

            // fired with api call to increment the pinned jobs
            pulsePinCount: "pulse-pin-count-EVT",

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

            duplicateJobsVisibilityChanged: "duplicate-jobs-visibility-changed-EVT",

            toggleRevisions: "toggle-revisions-EVT",

            showRunnableJobs: "show-runnable-jobs-EVT",

            deleteRunnableJobs: "delete-runnable-jobs-EVT",

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

            openLogviewer: "open-logviewer-EVT",

            autoclassifyVerified: "ac-verified-EVT",

            autoclassifySaveAll: "ac-save-all-EVT",

            autoclassifySave: "ac-save-EVT",

            autoclassifyIgnore: "ac-ignore-EVT",

            autoclassifyOther: "ac-other-EVT",

            autoclassifySelectOption: "ac-select-EVT",

            autoclassifyChangeSelection: "ac-change-selection-EVT",

            autoclassifyToggleExpandOptions: "ac-toggle-expand-options-EVT",

            autoclassifyToggleEdit: "ac-toggle-edit-EVT"

        };
    };
});

treeherder.provider('thAggregateIds', function () {
    this.$get = function () {
        return {
            getPlatformRowId: aggregateIds.getPlatformRowId,
            getResultsetTableId: aggregateIds.getResultsetTableId,
            getJobMapKey: aggregateIds.getJobMapKey,
            getGroupMapKey: aggregateIds.getGroupMapKey,
            escape: aggregateIds.escape
        };
    };
});

treeherder.provider('thReftestStatus', function () {
    this.$get = function () {
        return function (job) {
            if (job.job_group_name) {
                return (job.job_group_name.toLowerCase().indexOf('reftest') !== -1 ||
                        job.job_type_name.toLowerCase().indexOf('reftest') !== -1);
            }
        };
    };
});
