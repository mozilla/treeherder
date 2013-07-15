"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http) {
        // get the job groups
        $http.get('resources/job_groups.json').success(function(data) {
            $scope.job_groups = data;
            $scope.job_types = [];
            for (var group in $scope.job_groups){
                for(var job_type in $scope.job_groups[group]){
                    $scope.job_types.push($scope.job_groups[group][job_type]);
                }
            }

        });

        // get a push sample
        $http.get('resources/push_sample.json').success(function(data) {
            $scope.push_sample = data;
        });

        /*
        this is just to emulate the platform results
        the real objects will be something like this 
        {
            "platform": platform_name,
            jobs:[
                {
                    "id",
                    "symbol":"",
                    "description":"",
                    "status": "pending|running|completed|retriggered, etc.."
        
                }
            ]
        
        }
        */    
        $scope.platforms=["Ubuntu pto", "Ubuntu debug", "Win 7", "win XP", "OSX 10.7", "Android", "Fedora"];

        /*manage the collapsed push sections*/
        $scope.uncollapsed=[]
        
        $scope.isCollapsed = function(x){
        	return $scope.uncollapsed.indexOf(x) < 0
        }

        $scope.toggleCollapse = function(x){
        	if ($scope.isCollapsed(x)){
        		$scope.uncollapsed.push(x);
        	}else{
        		delete $scope.uncollapsed[$scope.uncollapsed.indexOf(x)];
        	}
        }


    }
);
