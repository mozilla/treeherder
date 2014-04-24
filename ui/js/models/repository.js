'use strict';

treeherder.factory('ThRepositoryModel',
                   function($http, thUrl, $rootScope, ThLog, localStorageService,
                            thSocket, treeStatus) {
    var $log = new ThLog("ThRepositoryModel");

    var new_failures = {};
    var repos = {};

    thSocket.on('job_failure', function(msg){
        if (! new_failures.hasOwnProperty(msg.branch)){
            new_failures[msg.branch] = [];
        }
        new_failures[msg.branch].push(msg.id);
        $log.debug("new failure on branch ", msg.branch);
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
        repos[repo.name] = {
            isWatched: false,
            treeStatus: null,
            unclassifiedFailureCount: 0
        };
    };

    /**
     * We want to add this repo as watched, but we also
     * want to get the treestatus for it
     */
    var addAsWatched = function(data, repoName) {
        if (data.isWatched) {
            repos[repoName] = {
                isWatched: true,
                treeStatus: null,
                unclassifiedFailureCount: 0
            };
            updateTreeStatus(repoName);

            // a static method to retrieve a single instance of ThJobModel
            $http.get(thUrl.getProjectUrl("/jobs/0/unclassified_failure_count/", repoName)).then(function(response) {
                repos[repoName].unclassifiedFailureCount = response.data.unclassified_failure_count;
            });


            // Add a connect listener
            thSocket.on('connect',function() {
                // subscribe to all the events for this repo
                thSocket.emit('subscribe', repoName);
            });

            $log.debug("addAsWatched", repos[repoName]);
            //Set up the socket listener
            thSocket.on(
                "unclassified_failure_count",
                function(data) {
                    if (data.branch === repoName) {
                        $log.debug("event unclassified_failure_count", data);
                        repos[repoName].unclassifiedFailureCount = data.count;
                    }
                }
            );

            $log.debug("watchedRepo", repoName, repos[repoName]);
        }
    };

    var unwatch = function(name) {
        if (!_.contains(repos, name)) {
            repos[name].isWatched = false;
        }
        watchedReposUpdated();
    };

    var get_uri = function(){
        return thUrl.getRootUrl("/repository/");
    };

    var get_list = function () {
        return $http.get(get_uri(), {cache: true});
    };

    var load = function(name) {

        var storedWatchedRepos = localStorageService.get("watchedRepos");

        return get_list().
            success(function(data) {
                $rootScope.repos = data;
                $rootScope.groupedRepos = getByGroup();

                _.each(data, addAsUnwatched);
                if (storedWatchedRepos) {
                    _.each(storedWatchedRepos, addAsWatched);
                }
                localStorageService.add("watchedRepos", repos);

                if (name) {
                    $rootScope.currentRepo = getByName(name);
                    addAsWatched({isWatched: true}, name);
                }
                watchedReposUpdated();
            });
    };


    var getCurrent = function() {
        return $rootScope.currentRepo;
    };

    var setCurrent = function(name) {
        $rootScope.currentRepo = getByName(name);
        $log.debug("repoModel", "setCurrent", name, "watchedRepos", repos);
    };

    var repo_has_failures = function(repo_name){
        return ($rootScope.new_failures.hasOwnProperty(repo_name) &&
            $rootScope.new_failures[repo_name].length > 0);
    };

    var watchedReposUpdated = function(repoName) {
        localStorageService.add("watchedRepos", repos);
        if (repoName) {
            updateTreeStatus(repoName);
        } else {
            updateAllWatchedRepoTreeStatus();
        }
    };

    var updateTreeStatus = function(repoName) {
        if (repos[repoName].isWatched) {
            $log.debug("updateTreeStatus", "updating", repoName);
            treeStatus.get(repoName).then(function(data) {
                    repos[repoName].treeStatus = data.data;
                }, function(data) {
                    repos[repoName].treeStatus = {
                        status: "unavailable",
                        message_of_the_day: repoName +
                            ' is not supported in <a href="https://treestatus.mozilla.org">treestatus.mozilla.org</a>'
                    };
                });
        }
    };

    var updateAllWatchedRepoTreeStatus = function() {
        _.each(_.keys(repos), updateTreeStatus);
    };


    return {
        // load the list of repos into $rootScope, and set the current repo.
        load: load,

        get_list: get_list,

        // return the currently selected repo
        getCurrent: getCurrent,

        // set the current repo to one in the repos list
        setCurrent: setCurrent,

        // get a repo object without setting anything
        getRepo: getByName,

        getByGroup: getByGroup,

        watchedRepos: repos,

        watchedReposUpdated: watchedReposUpdated,

        unwatch: unwatch,

        updateAllWatchedRepoTreeStatus: updateAllWatchedRepoTreeStatus,

        repo_has_failures: repo_has_failures

    };
});
