'use strict';

admin.controller('ProfilesListCtrl', ['$scope', 'thNotify',
    function ProfilesListCtrl($scope, thNotify) {

        $scope.init = function() {
            $scope.populateProfilesMap();
            $scope.populateExclusionsMap();
        };

        $scope.deleteProfile = function(profile) {
            if (!window.confirm('This will delete the exclusion. Are you sure?')) {
                return;
            }
            profile.delete().then(function() {
                var index = $scope.profiles.indexOf(profile);
                $scope.profiles.splice(index, 1);
            });
        };

        $scope.setDefaultProfile = function(profile) {
            profile.is_default = true;
            profile.update().then(function() {
                angular.forEach($scope.profiles, function(elem) {
                    if (elem.is_default && elem.id !== profile.id) {
                        elem.is_default = false;
                    }
                });
                thNotify.send($scope.REFRESH_MSG);
            }, null);
        };
    }]);
