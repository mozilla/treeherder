'use strict';

admin.controller('ExclusionsDetailCtrl', [
    '$scope', 'ThJobExclusionModel', 'thNotify', '$state', '$stateParams',
    function ExclusionsDetailCtrl(
        $scope, ThJobExclusionModel, thNotify, $state, $stateParams) {

        $scope.init = function() {
            $scope.initMasterLists().then(function() {
                $scope.populateExclusionsData().then(function() {
                    var id = $stateParams.id;
                    if (id === "new") {
                        $scope.resetExclusion();
                    } else {
                        $scope.initUpdate(id);
                    }
                    $scope.initDone = true;
                });
            });
        };

        // Init the exclusion change form
        $scope.initUpdate = function(id) {
            $scope.resetExclusion();
            $scope.form_exclusion = $scope.exclusionsMap[id];
            if ($scope.form_exclusion) {
                angular.forEach(['platforms', 'job_types', 'option_collections', 'repos'], function (elem) {
                    // assign to the left selection the remaining items
                    $scope['form_' + elem] = _.difference(
                        $scope['master_' + elem], // this is the whole list
                        $scope.form_exclusion.info[elem] // this is what we got
                    );
                });
            } else {
                // tried to navigate to an exclusion that doesn't exist
                thNotify.send("Unknown exclusion id: " + id, "danger");
                $state.go("exclusions");
            }
        };

        $scope.saveExclusion = function(exclusion) {
            // convert option_collections to option_collection_hashes
            exclusion.info.option_collection_hashes = [];
            _.each(exclusion.info.option_collections, function(oc) {
                exclusion.info.option_collection_hashes.push(
                    $scope.option_collection_hash_map[oc]);
            });

            if (exclusion.id) {
                exclusion.update().then(function() {
                    $state.go('exclusions');
                }, null);
            } else {
                exclusion = new ThJobExclusionModel(exclusion);
                exclusion.create().then(function() {
                    $scope.exclusions.push(exclusion);
                    $scope.resetExclusion();
                    $state.go('exclusions');
                }, null);
            }
            thNotify.send($scope.REFRESH_MSG);
        };

        $scope.resetExclusion = function() {
            // reset the user choices
            $scope.form_exclusion = angular.copy($scope.master_exclusion);
            // and reset the available choices
            $scope.form_platforms = angular.copy($scope.master_platforms);
            $scope.form_job_types = angular.copy($scope.master_job_types);
            $scope.form_option_collections = angular.copy($scope.master_option_collections);
            $scope.form_repos = angular.copy($scope.master_repos);
        };
}]);
