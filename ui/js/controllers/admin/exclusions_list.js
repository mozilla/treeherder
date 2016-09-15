'use strict';

admin.controller('ExclusionsListCtrl', ['$scope',
    function ExclusionsListCtrl($scope) {
        $scope.delete_exclusion = function(exclusion) {
            exclusion.delete().then(function() {
                // update the exclusion profiles since some of them may keep
                // an old relationship with the exclusion just deleted
                $scope.populateProfilesData();
                // delete the exclusion from the exclusion map
                delete $scope.exclusionsMap[String(exclusion.id)];
                // and from the list of available exclusions
                var index = $scope.exclusions.indexOf(exclusion);
                $scope.exclusions.splice(index, 1);
            });
        };
    }]);
