'use strict';
treeherder.controller('SheriffCtrl', [
    '$scope', '$rootScope', 'ThBuildPlatformModel', 'ThJobTypeModel',
    'thEvents', 'ThRepositoryModel', 'ThOptionModel', 'ThJobExclusionModel',
    'ThExclusionProfileModel',
    function SheriffController(
        $scope, $rootScope, ThBuildPlatformModel, ThJobTypeModel, thEvents,
        ThRepositoryModel, ThOptionModel, ThJobExclusionModel,
        ThExclusionProfileModel) {

        // fetch the reference data
        $scope.exclusions = [];
        $scope.exclusions_map = {};

        ThJobExclusionModel.get_list().then(function(data) {
            $scope.exclusions = data;
            $scope.exclusions_map = _.indexBy($scope.exclusions, 'id');
        });

        $scope.profiles = [];

        // get a cached version of the model
        ThExclusionProfileModel.get_list({}, true).then(function(data) {
            $scope.profiles = data;
        });


        $scope.view = 'exclusion_profile_list';
        $scope.switchView = function(newView) {
            $scope.view = newView;
        };

        // initialize the list of platform
        $scope.master_platforms = [];
        ThBuildPlatformModel.get_list()
        .then(function(data) {
            for (var i = 0; i < data.length; i++) {
                $scope.master_platforms.push(data[i].platform);
            }
            $scope.form_platforms = angular.copy($scope.master_platforms);
        });

        // initialize the list of job_types
        $scope.master_job_types = [];
        ThJobTypeModel.get_list()
        .then(function(data) {
            for (var i = 0; i < data.length; i++) {
                $scope.master_job_types.push(data[i].name + ' ('+ data[i].symbol + ')');
            }
            $scope.form_job_types = angular.copy($scope.master_job_types);
        });

        // initialize the list of repos
        $scope.master_repos = [];
        ThRepositoryModel.get_list()
            .success(function(data) {
                for (var i = 0; i < data.length; i++) {
                    $scope.master_repos.push(data[i].name);
                }
                $scope.form_repos = angular.copy($scope.master_repos);
            });

        // initialize the list of options
        $scope.master_options = [];
        ThOptionModel.get_list()
            .then(function(data) {
                for (var i = 0; i < data.length; i++) {
                    $scope.master_options.push(data[i].name);
                }
                $scope.form_options = angular.copy($scope.master_options);
            });

        // init the master properties for the forms

        $scope.master_exclusion = {};
        $scope.master_exclusion.name = '';
        $scope.master_exclusion.description = '';
        $scope.master_exclusion.info = {};
        $scope.master_exclusion.info.platforms = [];
        $scope.master_exclusion.info.job_types = [];
        $scope.master_exclusion.info.options = [];
        $scope.master_exclusion.info.repos = [];

        $scope.master_profile = {name: '', exclusions: []};


        // form handling functions

        $scope.reset_exclusion = function() {
            // reset the user choices
            $scope.form_exclusion = angular.copy($scope.master_exclusion);
            // and reset the available choices
            $scope.form_platforms = angular.copy($scope.master_platforms);
            $scope.form_job_types = angular.copy($scope.master_job_types);
            $scope.form_options = angular.copy($scope.master_options);
            $scope.form_repos = angular.copy($scope.master_repos);
        };

        $scope.save_exclusion = function(exclusion) {
            if (exclusion.id) {
                exclusion.update().then(function() {
                    $scope.switchView('job_exclusion_list');
                }, null);
            }else {
                exclusion = new ThJobExclusionModel(exclusion);
                exclusion.create().then(function() {
                    $scope.exclusions.push(exclusion);
                    $scope.reset_exclusion();
                    $scope.reset_profile();
                    $scope.switchView('job_exclusion_list');
                }, null);
            }
        };

        $scope.delete_exclusion = function(exclusion) {
            exclusion.delete().then(function() {
                // update the visibility profiles
                // since some of them may keep an old relationship
                // with the exclusion just deleted
                ThExclusionProfileModel.get_list().then(function(data) {
                    $scope.profiles = data;
                })
                // delete the exclusion from the exclusion map
                delete $scope.exclusions_map[exclusion.id + ''];

                // and from the list of available exclusions
                var index = $scope.exclusions.indexOf(exclusion);
                $scope.exclusions.splice(index, 1);
            });
        };

        // Init the exclusion add form
        $scope.init_exclusion_add = function() {
            $scope.reset_exclusion();
            $scope.switchView('job_exclusion_add');
        };

        // Init the exclusion change form
        $scope.init_exclusion_update = function(exclusion) {
            $scope.form_exclusion = exclusion;
            angular.forEach(['platforms', 'job_types', 'options', 'repos'], function(elem) {
                // assign to the left selection the remaining items
                $scope['form_'+ elem] = _.difference(
                    $scope['master_'+ elem], // this is the whole list
                    $scope.form_exclusion.info[elem] // this is what we got
                );
            });
            $scope.switchView('job_exclusion_add');
        };



        $scope.reset_profile = function() {
            $scope.form_profile = angular.copy($scope.master_profile);
            $scope.form_profile_choices = {};
        };

        $scope.save_profile = function(profile) {
            var choices = [];
            angular.forEach($scope.form_profile_choices, function(value, key) {
                if (value) {
                    choices.push(key);
                }
            });
            $scope.form_profile.exclusions = choices;
            if (profile.id) {
                //angular.extend(profile, $scope.form_profile);
                profile.update().then(function() {
                    $scope.switchView('exclusion_profile_list');
                }, null);
            }else {
                var profile = new ThExclusionProfileModel($scope.form_profile);
                profile.create().then(
                    function() {
                        $scope.profiles.push(profile);
                        $scope.switchView('exclusion_profile_list');
                    }, null);
            }
        };

        $scope.delete_profile = function(profile) {
            profile.delete().then(function() {
                var index = $scope.profiles.indexOf(profile);
                $scope.profiles.splice(index, 1);
            });
        };

        $scope.set_default_profile = function(profile) {
            profile.is_default = true;
            profile.update().then(function(data) {
                angular.forEach($scope.profiles, function(elem) {
                    if (elem.is_default && elem.id !== profile.id) {
                        elem.is_default = false;
                    }
                });
                $rootScope.active_exclusion_profile = profile;
                $rootScope.$broadcast(thEvents.globalFilterChanged, null);
            }, null);
        };

        // init the profile add form
        $scope.init_profile_add = function() {
            $scope.reset_profile();
            $scope.switchView('exclusion_profile_add');
        };

        // init the profile update form
        $scope.init_profile_update = function(profile) {
            $scope.form_profile = profile;
            $scope.form_profile_choices = {};
            angular.forEach($scope.form_profile.exclusions, function(exclusion_id) {
                $scope.form_profile_choices[exclusion_id] = true;
            });
            $scope.switchView('exclusion_profile_add');
        };
    }
]);
