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
                   star: "label-important"
            }
        };
    };
});

treeherder.provider('thResultStatusInfo', function() {
    this.$get = function() {
        return function(resultState) {
            // default if there is no match, used for pending
            var resultStatusInfo = {
                btnClass: "btn-default",
                showButtonIcon: "glyphicon glyphicon-time",
                jobButtonIcon: ""
            };

            switch (resultState) {
                case "busted":
                    resultStatusInfo = {
                        btnClass: "btn-danger",
                        showButtonIcon: "glyphicon glyphicon-fire",
                        jobButtonIcon: "glyphicon glyphicon-fire"
                    };
                    break;
                case "exception":
                    resultStatusInfo = {
                        btnClass: "btn-purple",
                        showButtonIcon: "glyphicon glyphicon-fire",
                        jobButtonIcon: "glyphicon glyphicon-fire"
                    };
                    break;
                case "running":
                    resultStatusInfo = {
                        btnClass: "btn-ltgray",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
                case "retry":
                    resultStatusInfo = {
                        btnClass: "btn-primary",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
                case "success":
                    resultStatusInfo = {
                        btnClass: "btn-success",
                        showButtonIcon: "glyphicon glyphicon-ok",
                        jobButtonIcon: ""
                    };
                    break;
                case "testfailed":
                    resultStatusInfo = {
                        btnClass: "btn-warning",
                        showButtonIcon: "glyphicon glyphicon-warning-sign",
                        jobButtonIcon: "glyphicon glyphicon-warning-sign"
                    };
                    break;
                case "usercancel":
                    resultStatusInfo = {
                        btnClass: "btn-pink",
                        showButtonIcon: "glyphicon glyphicon-stop",
                        jobButtonIcon: ""
                    };
                    break;
                case "unknown":
                    resultStatusInfo = {
                        btnClass: "btn-black",
                        showButtonIcon: "glyphicon glyphicon-time",
                        jobButtonIcon: ""
                    };
                    break;
            }

            return resultStatusInfo;
        };

    };
});
