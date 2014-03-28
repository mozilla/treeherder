"use strict";
treeherder.controller('SheriffCtrl',
    function SheriffController($scope, $log, ThBuildPlatformModel, ThJobTypeModel,
                               ThRepositoryModel, ThOptionModel){

        $scope.filters = [];
        $scope.filters.push({
            "name": "random filter",
            "description": "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt",
            "platforms": [
                "b2g-linux64",
                "b2g-linux32",
                "b2g-win32",
                "b2g-emu-ics"
            ],
            "job_types": [
                "B2G Emulator Image Build (B)"
            ],
            "options": [
                "pgo"
            ]
        });
        $scope.profiles = [];

        $scope.view = "vis_profile_list";
        $scope.switchView = function(newView){
            $scope.view = newView;
        }

        // initialize the list of platform
        $scope.master_platforms = [];
        ThBuildPlatformModel.get_list()
        .then(function(data){
            for(var i=0; i<data.length; i++){
                $scope.master_platforms.push(data[i].platform);
            }
            $scope.form_platforms = angular.copy($scope.master_platforms);
        });

        // initialize the list of job_types
        $scope.master_job_types = [];
        ThJobTypeModel.get_list()
        .then(function(data){
            for(var i=0; i<data.length; i++){
                $scope.master_job_types.push(data[i].name +" ("+data[i].symbol+")" );
            }
            $scope.form_job_types = angular.copy($scope.master_job_types);
        });

        // initialize the list of repos
        $scope.master_repos = [];
        ThRepositoryModel.get_list()
            .success(function(data){
                $log.log(data);
                for(var i=0; i<data.length; i++){
                    $scope.master_repos.push(data[i].name);
                }
                $scope.form_repos = angular.copy($scope.master_repos);
                $log.log($scope.form_repos);
            })

        // initialize the list of options
        $scope.master_options = [];
        ThOptionModel.get_list()
            .then(function(data){
                for(var i=0; i<data.length; i++){
                    $scope.master_options.push(data[i].name);
                }
                $scope.form_options = angular.copy($scope.master_options);
            })


        // Init the add filter view
        $scope.master_filter = {};
        $scope.master_filter.name = ""
        $scope.master_filter.description = "";
        $scope.master_filter.platforms = [];
        $scope.master_filter.job_types = [];
        $scope.master_filter.options = [];

        $scope.form_filter = angular.copy($scope.master_filter);

        $scope.reset_filter = function(){
            // reset the user choices
            $scope.form_filter = angular.copy($scope.master_filter);
            // and reset the available choices
            $scope.form_platforms = angular.copy($scope.master_platforms);
            $scope.form_job_types = angular.copy($scope.master_job_types);
            $scope.form_options = angular.copy($scope.master_options);
        };

        $scope.save_filter = function(){
            $scope.filters.push($scope.form_filter);

            $scope.reset_filter();
            $scope.reset_profile();
            $scope.switchView("job_filter_list");
        };

        // Init the add profile view

        $scope.master_profile = {name:"", filters:{}};

        $scope.reset_profile = function(){
            $scope.form_repos = angular.copy($scope.master_repos);
            $scope.form_profile = angular.copy($scope.master_profile)
            for(var i=0; i<$scope.filters.length;i++){
                $scope.form_profile.filters[$scope.filters[i].name] = [];
            }

        };

        // this must be called as soon as we get the available filters
        $scope.reset_profile();

        $scope.save_profile = function(){
            $scope.profiles.push($scope.form_profile);
            $scope.reset_profile();
            $scope.switchView("vis_profile_list");
        };

    }
)
