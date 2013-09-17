"use strict";

treeherder.controller('PluginCtrl',
    function PluginCtrl($scope) {
        $scope.tabs = [
            {
                title: "Jobs Detail",
                content: "plugins/jobdetail/main.html",
                active: true
            },
            {
                title: "Jobs Foo",
                content: ""
            }
        ];

        $scope.registerPlugin = function(pluginData) {
            $scope.tabs.append(pluginData);
        };

        $scope.getJob = function() {
            return $scope.selectedJob;
        };
    }
);
