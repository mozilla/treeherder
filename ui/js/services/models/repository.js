'use strict';

treeherder.factory('ThRepositoryModel',
                   function($http, thUrl, $rootScope, $log, localStorageService,
                            thSocket, thEvents) {

    var new_failures = {};

    thSocket.on('job_failure', function(msg){
        if (! new_failures.hasOwnProperty(msg.branch)){
            new_failures[msg.branch] = [];
        }
        new_failures[msg.branch].push(msg.id);
        $log.debug("new failure on branch "+msg.branch);
    });


    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    var byName = function(name) {
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
    var byGroup = function() {
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
        api.watchedRepos[repo.name] = false;
    };

    var api = {
        // load the list of repos into $rootScope, and set the current repo.
        load: function(name) {

            var storedWatchedRepos = localStorageService.get("watchedRepos");
            $log.debug("stored watchedRepos");
            $log.debug(storedWatchedRepos);

            return $http.get(thUrl.getRootUrl("/repository/")).
                success(function(data) {
                    $rootScope.repos = data;
                    $rootScope.groupedRepos = byGroup();
                    _.each(data, addAsUnwatched);
                    if (storedWatchedRepos) {
                        _.extend(api.watchedRepos, storedWatchedRepos);
                        localStorageService.remove("watchedRepos");
                    }
                    localStorageService.add("watchedRepos", api.watchedRepos);

                    if (name) {
                        $rootScope.currentRepo = byName(name);

                    }
                });
        },
        // return the currently selected repo
        getCurrent: function() {
            return $rootScope.currentRepo;
        },
        // set the current repo to one in the repos list
        setCurrent: function(name) {
            $rootScope.currentRepo = byName(name);
            api.watchedRepos[name] = true;
            api.watchedReposUpdated();
        },
        // get a repo object without setting anything
        getRepo: function(name) {
            return byName(name);
        },
        getByGroup: function() {
            return byGroup();
        },
        watchedRepos: {},
        watchedReposUpdated: function() {
//            localStorageService.cookie.add("watchedRepos", api.watchedRepos);

            $log.debug("watchedReposUpdated");
            console.log("watchedReposUpdated");
//            $log.debug(localStorageService.cookie.get("watchedRepos"));

            $rootScope.$broadcast(thEvents.topNavBarContentChanged);
        },
        repo_has_failures: function(repo_name){
            return ($rootScope.new_failures.hasOwnProperty(repo_name) &&
                $rootScope.new_failures[repo_name].length > 0);
        }

    };

    return api;
});
