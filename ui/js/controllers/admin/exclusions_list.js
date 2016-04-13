'use strict';

admin.controller('ExclusionsListCtrl', [
    '$scope', 'ThJobExclusionModel', 'ThExclusionProfileModel', '$state',
    function ExclusionsListCtrl(
        $scope, ThJobExclusionModel, ThExclusionProfileModel, $state) {

        $scope.profiles = [];

        $scope.init = function() {
            $scope.populateExclusionsMap();
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
            }else {
                exclusion = new ThJobExclusionModel(exclusion);
                exclusion.create().then(function() {
                    $scope.exclusions.push(exclusion);
                    $scope.resetExclusion();
                    $scope.resetProfile();
                    $state.go('exclusions');
                }, null);
            }
            $scope.refreshExclusionProfileList();
        };

        $scope.delete_exclusion = function(exclusion) {
            exclusion.delete().then(function() {
                // update the exclusion profiles
                // since some of them may keep an old relationship
                // with the exclusion just deleted
                ThExclusionProfileModel.get_list().then(function(data) {
                    $scope.profiles = data;
                });
                // delete the exclusion from the exclusion map
                delete $scope.exclusionsMap[String(exclusion.id)];

                // and from the list of available exclusions
                var index = $scope.exclusions.indexOf(exclusion);
                $scope.exclusions.splice(index, 1);
            });
            $scope.refreshExclusionProfileList();
        };
    }]);
