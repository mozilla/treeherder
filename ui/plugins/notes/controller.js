"use strict";

treeherder.controller('NotesPluginCtrl',
    function NotesPluginCtrl($scope, $log) {
        $log.debug("notes plugin initialized");

        $scope.$watch('notes', function(newValue, oldValue){

            $scope.tabs.notes.num_items = newValue ? $scope.notes.length : 0;
        }, true);
    }
);
