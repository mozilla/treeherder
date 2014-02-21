treeherder.provider('thServiceDomain', function() {
    this.$get = function() {
        if (window.thServiceDomain) {
            return window.thServiceDomain;
        } else {
            return "";
        }
    };
});

treeherder.provider('thStarTypes', function() {
    this.$get = function() {
        return {
            0: {
                   name: "expected fail",
                   star: "label-info"
            },
            1: {
                   name: "fixed by backout",
                   star: "label-success"
            },
            2: {
                   name: "intermittent",
                   star: "label-warning"
            },
            3: {
                   name: "infra",
                   star: "label-default"
            },
            4: {
                   name: "intermittent needs filing",
                   star: "label-danger"
            }
        };
    };
});

treeherder.provider('thResultStatusList', function() {
    this.$get = function() {
        return ['success', 'testfailed', 'busted', 'exception', 'retry', 'running', 'pending'];
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
            revisionsLoaded: "revisions-loaded-EVT",
            toggleRevisions: "toggle-revisions-EVT",
            toggleJobs: "toggle-jobs-EVT",
            jobClick:        "job-click-EVT",
            jobContextMenu:  "job-context-menu-EVT",
            jobUpdated:      "job-updated-EVT"
        };
    };
});
