'use strict';

treeherder.factory('ThRepositoryModel', [
    '$http', 'thUrl', '$rootScope', 'ThLog', '$interval',
    'thSocket', 'treeStatus',
    function(
        $http, thUrl, $rootScope, ThLog, $interval,
        thSocket, treeStatus) {

    var $log = new ThLog("ThRepositoryModel");

    var new_failures = {};
    var repos = {};
    var watchedRepos = {};

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

    var addRepoAsUnwatched = function(repo) {
        repos[repo.name] = {
            isWatched: false,
            treeStatus: null,
            unclassifiedFailureCount: 0,
            unclassifiedFailureCountExcluded: 0
        };
    };

    /**
     * We want to add this repo as watched, but we also
     * want to get the treestatus for it
     */
    var watchRepo = function(repoName) {
        repos[repoName] = {
            isWatched: true,
            treeStatus: null,
            unclassifiedFailureCount: 0,
            unclassifiedFailureCountExcluded: 0
        };
        watchedRepos[repoName] = repos[repoName];
        updateTreeStatus(repoName);
        watchedReposUpdated();

        // fetch the
        // current count of unclassified failures, rather than waiting
        // for the socket event to be published.
        $http.get(thUrl.getProjectUrl("/jobs/0/unclassified_failure_count/", repoName)).then(function(response) {
            repos[repoName].unclassifiedFailureCount = response.data.count;
            repos[repoName].unclassifiedFailureCountExcluded = response.data.count_excluded;
        });

        // Add a connect listener
        thSocket.on('connect',function() {
            // subscribe to all the events for this repo
            thSocket.emit('subscribe', repoName);
        });

        // setup to listen for the socket events that notify us of the
        // current count of unclassified failures.
        thSocket.on(
            "unclassified_failure_count",
            function(data) {
                if (data.branch === repoName) {

                    $log.debug("event unclassified_failure_count", data);
                    repos[repoName].unclassifiedFailureCount = data.count;
                    repos[repoName].unclassifiedFailureCountExcluded = data.count_excluded;
                }
            }
        );

        $log.debug("watchedRepo", repoName, repos[repoName]);
    };

    var unwatchRepo = function(name) {
        $log.debug("unwatchRepo", name, watchedRepos);
        delete watchedRepos[name];
        repos[name].isWatched = false;
        watchedReposUpdated();
    };

    var get_uri = function(){
        return thUrl.getRootUrl("/repository/");
    };

    var get_list = function () {
        return $http.get(get_uri(), {cache: true});
    };

    var load = function(name) {

        if (!$rootScope.repos) {
            return get_list().
                success(function (data) {
                    $rootScope.repos = data;
                    $rootScope.groupedRepos = getByGroup();

                    _.each(data, addRepoAsUnwatched);
                    var storedWatched = JSON.parse(sessionStorage.getItem("thWatchedRepos"));
                    if (_.isArray(storedWatched)) {
                        _.each(storedWatched, function (repo) {
                            watchRepo(repo);
                        });
                    }

                    if (name) {
                        setCurrent(name);
                    }
                    watchedReposUpdated();
                    updateAllWatchedRepoTreeStatus();
                });
        } else {
            setCurrent(name);
        }

        // update the repo status (treestatus) in an interval of every 2 minutes
        $interval(updateAllWatchedRepoTreeStatus, 2 * 60 * 1000);
    };


    var getCurrent = function() {
        return $rootScope.currentRepo;
    };

    var setCurrent = function(name) {
        $rootScope.currentRepo = getByName(name);

        // don't want to just replace the watchedRepos object because
        // controllers, etc, are watching the reference to it, which would
        // be lost by replacing.
        if (_.size(watchedRepos) <= 1) {
            _.each(watchedRepos, function(r, rname) {
                unwatchRepo(rname);
            });
        }
        watchRepo(name);


        $log.debug("repoModel", "setCurrent", name, "watchedRepos", repos);
    };

    var watchedReposUpdated = function() {
        sessionStorage.setItem("thWatchedRepos", JSON.stringify(_.keys(watchedRepos)));
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

    var toggleWatched = function(repoName) {
        $log.debug("toggleWatched", repoName, repos[repoName]);
        if (repos[repoName].isWatched) {
            unwatchRepo(repoName);
        } else {
            watchRepo(repoName);
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

        repos: repos,

        watchedRepos: watchedRepos,

        watchedReposUpdated: watchedReposUpdated,

        unwatchRepo: unwatchRepo,

        toggleWatched: toggleWatched,

        updateAllWatchedRepoTreeStatus: updateAllWatchedRepoTreeStatus

    };
}]);
