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
