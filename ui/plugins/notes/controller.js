"use strict";

treeherder.controller('NotesPluginCtrl',
    function NotesPluginCtrl($scope, $log) {
        $log.debug("notes plugin initialized");

        $scope.$watch('notes', function(newValue, oldValue){
            for(var tab=0; tab<$scope.tabs.length; tab++){
                if ($scope.tabs[tab].id == 'notes'){
                    if(newValue){
                        $scope.tabs[tab].num_items = $scope.notes.length;
                    }else{
                        $scope.tabs[tab].num_items = 0;
                    }
                }
            }
        }, true);
    }
);
