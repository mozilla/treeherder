"use strict";

treeherder.controller('PluginCtrl',
    function PluginCtrl($scope, $rootScope) {

        $scope.tabs = [
            {
                title: "Jobs Detail",
                content: "plugins/jobdetail/main.html",
                active: true
            },
            {
                title: "Jobs Foo",
                content: "plugins/jobfoo/main.html"
            }
        ];

    }
);
