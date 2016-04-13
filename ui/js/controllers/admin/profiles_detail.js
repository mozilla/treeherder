'use strict';

admin.controller('ProfilesDetailCtrl', [
    '$scope', 'ThExclusionProfileModel', 'thNotify', '$state',
    '$stateParams', '$q',
    function ProfilesDetailCtrl(
        $scope, ThExclusionProfileModel, thNotify, $state,
        $stateParams, $q) {

        $scope.init = function() {
            $q.all([
                $scope.populateProfilesMap(),
                $scope.populateExclusionsMap()
            ]).then(function() {
                var id = $stateParams.id;
                if (id === "new") {
                    $scope.resetProfile();
                } else {
                    $scope.initUpdate(id);
                }
            });
        };

        // init the profile update form
        $scope.initUpdate = function(id) {
            $scope.resetProfile();
            $scope.form_profile = $scope.profilesMap[id];
            if ($scope.form_profile) {
                $scope.form_profile_choices = {};
                angular.forEach($scope.form_profile.exclusions, function(exclusion_id) {
                    $scope.form_profile_choices[exclusion_id] = true;
                });
            } else {
                // tried to navigate to an exclusion that doesn't exist
                thNotify.send("Unknown profile id: " + id, "danger");
                $state.go("profiles");
            }

        };

        $scope.resetProfile = function() {
            $scope.form_profile = angular.copy($scope.master_profile);
            $scope.form_profile_choices = {};
        };

        $scope.saveProfile = function(profile) {
            var choices = [];
            angular.forEach($scope.form_profile_choices, function(value, key) {
                if (value) {
                    choices.push(key);
                }
            });
            $scope.form_profile.exclusions = choices;
            if (profile.id) {
                profile.update().then(function() {
                    $state.go('profiles');
                }, null);
            } else {
                profile = new ThExclusionProfileModel($scope.form_profile);
                profile.create().then(
                    function() {
                        $state.go('profiles');
                    }, null);
            }
            thNotify.send($scope.REFRESH_MSG);
        };

    }]);
