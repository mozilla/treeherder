'use strict';

admin.controller('AdminCtrl', [
    '$scope', 'ThBuildPlatformModel', 'ThJobTypeModel', 'ThRepositoryModel',
    'ThOptionCollectionModel', 'ThJobExclusionModel', '$state',
    '$q','ThExclusionProfileModel',
    function AdminCtrl(
        $scope, ThBuildPlatformModel, ThJobTypeModel, ThRepositoryModel,
        ThOptionCollectionModel, ThJobExclusionModel, $state,
        $q,ThExclusionProfileModel) {

        $scope.REFRESH_MSG = "Refresh Treeherder windows to see changes reflected.";

        // allow ng-click to do state navigation.  This allows us to use it
        // with buttons that have ng-disabled conditional on sheriff access.
        // If we use ui-sref there, it will ignore the ng-disabled.
        $scope.go = $state.go.bind($state);

        $scope.populateProfilesMap = function() {
            return ThExclusionProfileModel.get_list({}, false).then(function (data) {
                $scope.profiles = _.map(data, function (profile) {
                    profile.showExcludedUrl = "/?exclusion_profile=" + profile.name +
                        "&visibility=excluded";
                    return profile;
                });
                $scope.profilesMap = _.indexBy($scope.profiles, 'id');
            });
        };

        $scope.populateExclusionsMap = function() {
            return ThJobExclusionModel.get_list().then(function (data) {
                $scope.exclusions = data;
                $scope.exclusionsMap = _.indexBy($scope.exclusions, 'id');
            });
        };

        /**
         * Used to allow for selection of "platform (arch)" or
         * "job_type (job_symbol)"
         */
        var getJobComboField = function(field1, field2) {
            return field1 + " (" + field2 + ")";
        };

        $scope.initMasterLists = function() {
            // initialize the list of platform
            var promise = $q.resolve();
            if (!$scope.masterListsInitialized) {
                $scope.master_platforms = [];
                var platformPromise = ThBuildPlatformModel.get_list()
                    .then(function(data) {
                        for (var i = 0; i < data.length; i++) {
                            $scope.master_platforms.push(
                                getJobComboField(data[i].platform, data[i].architecture)
                            );
                        }
                        $scope.master_platforms = _.uniq($scope.master_platforms.sort());
                        $scope.form_platforms = angular.copy($scope.master_platforms);
                    });

                // initialize the list of job_types
                $scope.master_job_types = [];
                var jobTypePromise = ThJobTypeModel.get_list()
                    .then(function(data) {
                        for (var i = 0; i < data.length; i++) {
                            $scope.master_job_types.push(
                                getJobComboField(data[i].name, data[i].symbol)
                            );
                        }
                        $scope.master_job_types = _.uniq($scope.master_job_types.sort());
                        $scope.form_job_types = angular.copy($scope.master_job_types);
                    });

                // initialize the list of repos
                $scope.master_repos = [];
                var repoPromise = ThRepositoryModel.get_list()
                    .success(function(data) {
                        for (var i = 0; i < data.length; i++) {
                            $scope.master_repos.push(data[i].name);
                        }
                        $scope.master_repos = _.uniq($scope.master_repos.sort());
                        $scope.form_repos = angular.copy($scope.master_repos);
                    });

                // initialize the list of option collections
                $scope.master_option_collections = [];

                var optPromise = ThOptionCollectionModel.getMap().then(function(optCollectionMap) {
                    // the string representations of the option collections
                    $scope.master_option_collections = _.values(optCollectionMap);

                    // use this to get the hashes for submitting after the
                    // user has selected them by strings
                    $scope.option_collection_hash_map = _.invert(optCollectionMap);

                    $scope.master_option_collections.sort();
                    $scope.form_option_collections = angular.copy($scope.master_option_collections);
                });

                // init the master properties for the forms
                $scope.master_exclusion = {
                    name: '',
                    description: '',
                    info: {
                        platforms: [],
                        job_types: [],
                        option_collections: [],
                        repos: []
                    }
                };

                $scope.master_profile = {name: '', exclusions: []};

                // the promises may not yet have returned, but this just tells
                // us that we don't need to re-run this function.
                $scope.masterListsInitialized = true;

                promise = $q.all([platformPromise,
                                  jobTypePromise,
                                  repoPromise,
                                  optPromise]);
            }
            return promise;
        };
    }
]);
