'use strict';

treeherder.factory('ThRepositoryModel',
                   function($http, thUrl, $rootScope, $log, localStorageService,
                            thSocket, thEvents) {

    var new_failures = {};

    var watchedRepos = {};

    thSocket.on('job_failure', function(msg){
        if (! new_failures.hasOwnProperty(msg.branch)){
            new_failures[msg.branch] = [];
        }
        new_failures[msg.branch].push(msg.id);
        $log.debug("new failure on branch "+msg.branch);
    });

    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    var getByName = function(name) {
        if ($rootScope.repos !== undefined) {
            for (var i = 0; i < $rootScope.repos.length; i++) {
                var repo = $rootScope.repos[i];
                if (repo.name === name) {
                    return repo;
                }
            }
        } else {
            $log.warn("Repos list has not been loaded.");
        }
        $log.warn("'" + name + "' not found in repos list.");
        return null;
    };


    // get by category
    var getByGroup = function() {
        var groupedRepos = {};
        var group = function(repo) {
            if (!_.has(groupedRepos, repo.repository_group.name)) {
                groupedRepos[repo.repository_group.name] = [];
            }
            groupedRepos[repo.repository_group.name].push(repo);
        };

        if (!groupedRepos.length) {
            _.each($rootScope.repos, group);
        }
        return groupedRepos;
    };

    var addAsUnwatched = function(repo) {
        watchedRepos[repo.name] = false;
    };

    var load = function(name) {

        var storedWatchedRepos = localStorageService.get("watchedRepos");

        return $http.get(thUrl.getRootUrl("/repository/")).
            success(function(data) {
                $rootScope.repos = data;
                $rootScope.groupedRepos = getByGroup();
                _.each(data, addAsUnwatched);
                if (storedWatchedRepos) {
                    _.extend(watchedRepos, storedWatchedRepos);
                }
                localStorageService.add("watchedRepos", watchedRepos);

                if (name) {
                    $rootScope.currentRepo = getByName(name);

                }
            });
    };

    var getCurrent = function() {
        return $rootScope.currentRepo;
    };

    var setCurrent = function(name) {
        $rootScope.currentRepo = getByName(name);
        watchedRepos[name] = true;
    };

    var repo_has_failures = function(repo_name){
        return ($rootScope.new_failures.hasOwnProperty(repo_name) &&
            $rootScope.new_failures[repo_name].length > 0);
    };

    var watchedReposUpdated = function() {
        localStorageService.add("watchedRepos", watchedRepos);
        $rootScope.$broadcast(thEvents.topNavBarContentChanged);
    };


    return {
        // load the list of repos into $rootScope, and set the current repo.
        load: load,

        // return the currently selected repo
        getCurrent: getCurrent,

        // set the current repo to one in the repos list
        setCurrent: setCurrent,

        // get a repo object without setting anything
        getRepo: getByName,

        getByGroup: getByGroup,

        watchedRepos: watchedRepos,

        watchedReposUpdated: watchedReposUpdated,

        repo_has_failures: repo_has_failures

    };
});
