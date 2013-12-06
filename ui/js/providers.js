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
                        jobButtonIcon: "glyphicon glyphicon-fire"
                    };
                    break;
                case "exception":
                    resultStatusInfo = {
                        severity: 2,
                        isCollapsedResults: false,
                        btnClass: "btn-purple",
                        showButtonIcon: "glyphicon glyphicon-fire",
                        jobButtonIcon: "glyphicon glyphicon-fire"
                    };
                    break;
                case "testfailed":
                    resultStatusInfo = {
                        severity: 3,
                        isCollapsedResults: false,
                        btnClass: "btn-orange",
                        showButtonIcon: "glyphicon glyphicon-warning-sign",
                        jobButtonIcon: "glyphicon glyphicon-warning-sign"
                    };
                    break;
                case "unknown":
                    resultStatusInfo = {
                        severity: 4,
                        isCollapsedResults: false,
                        btnClass: "btn-black",
                        showButtonIcon: "glyphicon glyphicon-warning-sign",
                        jobButtonIcon: ""
                    };
                    break;
                case "usercancel":
                    resultStatusInfo = {
                        severity: 5,
                        isCollapsedResults: true,
                        btnClass: "btn-pink",
                        showButtonIcon: "glyphicon glyphicon-stop",
                        jobButtonIcon: ""
                    };
                    break;
                case "retry":
                    resultStatusInfo = {
                        severity: 6,
                        isCollapsedResults: true,
                        btnClass: "btn-dkblue",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
                case "success":
                    resultStatusInfo = {
                        severity: 7,
                        isCollapsedResults: true,
                        btnClass: "btn-green",
                        showButtonIcon: "glyphicon glyphicon-ok",
                        jobButtonIcon: ""
                    };
                    break;
                case "running":
                    resultStatusInfo = {
                        severity: 8,
                        isCollapsedResults: true,
                        btnClass: "btn-ltgray",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
                case "pending":
                    resultStatusInfo = {
                        severity: 100,
                        isCollapsedResults: true,
                        btnClass: "btn-default",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
            }

            return resultStatusInfo;
        };

    };
});
