"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope) {
        $scope.registerPlugin(
            {
                title: "Jobs Detail",
                content: "plugins/jobdetail/main.html",
                active: true
            }
        );
    }
);
