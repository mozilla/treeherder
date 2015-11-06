'use strict';

treeherder.factory('ThRepositoryModel', [
    '$http', 'thUrl', '$rootScope', 'ThLog', '$interval',
    'treeStatus', 'thRepoGroupOrder',
    function(
        $http, thUrl, $rootScope, ThLog, $interval,
        treeStatus, thRepoGroupOrder) {

        var $log = new ThLog("ThRepositoryModel");

        var new_failures = {};
        var repos = {};
        var watchedRepos = {};
        var orderedRepoGroups = {};

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


        var getOrderedRepoGroups = function() {
            if (!_.size(orderedRepoGroups)) {
                var groups = _.groupBy($rootScope.repos, function(r) {return r.repository_group.name;});
                _.each(groups, function(reposAr, gName) {
                    orderedRepoGroups[thRepoGroupOrder[gName] || gName] = {name: gName, repos: reposAr};
                });
            }
            return orderedRepoGroups;
        };

        var addRepoAsUnwatched = function(repo) {
            repos[repo.name] = {
                treeStatus: null,
                unclassifiedFailureCount: 0,
                groupName: repo.repository_group.name
            };
        };

        /**
         * We want to add this repo as watched, but we also
         * want to get the treestatus for it
         */
        var watchRepo = function(repoName) {
            _.extend(repos[repoName], {
                treeStatus: {status: "not retrieved yet", message_of_the_day: ""},
                unclassifiedFailureCount: 0,
                groupName: repos[repoName].groupName
            });
            watchedRepos[repoName] = repos[repoName];
            updateTreeStatus(repoName);
            saveWatchedRepos();

            $log.debug("watchedRepo", repoName, repos[repoName]);
        };

        var unwatchRepo = function(name) {
            $log.debug("unwatchRepo", name, watchedRepos);
            delete watchedRepos[name];
            saveWatchedRepos();
        };

        var get_uri = function(){
            return thUrl.getRootUrl("/repository/");
        };

        var get_list = function () {
            return $http.get(get_uri(), {cache: true});
        };

        var load = function(options) {
            options = options || {};

            if (!$rootScope.repos) {
                // this is the first time this was called, so initiate the interval
                // update the repo status (treestatus) in an interval of every 2 minutes
                $log.debug("treestatus", "setting the interval");
                $interval(updateTreeStatus, 2 * 60 * 1000);

                // return the promise of getting the repos
                return get_list().
                    success(function(data) {
                        // FIXME: only supporting github + hg for now for pushlog
                        // + revision info (we also assume dvcs_type git==github)
                        function Repo(props) {
                            _.assign(this, props);
                            if (this.dvcs_type == 'git') {
                                // FIXME: assuming master branch, which may not
                                // always be right -- unfortunately fixing this
                                // requires backend changes as we're not storing
                                // such info explicitly right now
                                this.pushlogURL = this.url + "/commits/master";
                            } else {
                                this.pushlogURL = this.url + "/pushloghtml";
                            }
                        };
                        Repo.prototype = {
                            getRevisionHref: function(revision) {
                                if (this.dvcs_type == 'git') {
                                    return this.url + '/commit/' + revision;
                                }
                                return this.url + '/rev/' + revision;
                            },
                            getPushLogHref: function(revision) {
                                if (this.dvcs_type == 'git') {
                                    return this.getRevisionHref(revision);
                                }
                                return this.pushlogURL + '?changeset=' + revision;
                            }
                        };

                        $rootScope.repos = _.map(data, function(datum) {
                            return new Repo(datum);
                        });

                        _.each(data, addRepoAsUnwatched);
                        if (options.name) {
                            setCurrent(options.name);
                        }
                        if (options.watchRepos) {
                            var storedWatched = loadWatchedRepos();
                            if (_.isArray(storedWatched) &&
                                _.contains(storedWatched, options.name)) {
                                _.each(storedWatched, function (repo) {
                                    watchRepo(repo);
                                });
                            }
                            saveWatchedRepos();
                        }
                    });
            } else {
                if (options.name) {
                    setCurrent(options.name);
                }
            }
        };


        var getCurrent = function() {
            return $rootScope.currentRepo;
        };

        var setCurrent = function(name) {
            if (!$rootScope.currentRepo || $rootScope.currentRepo.name !== name) {
                $rootScope.currentRepo = getByName(name);

                // don't want to just replace the watchedRepos object because
                // controllers, etc, are watching the reference to it, which would
                // be lost by replacing.
                if (_.size(watchedRepos) <= 1) {
                    _.each(watchedRepos, function (r, rname) {
                        unwatchRepo(rname);
                    });
                }
                if (!_.has(watchedRepos, name)) {
                    watchRepo(name);
                }

                $log.debug("setCurrent", name, "watchedRepos", $rootScope.currentRepo, repos);
            } else {
                $log.debug("setCurrent", "Skipping.  Current repo was already set to " + name, $rootScope.currentRepo);
            }
        };

        var toggleWatched = function(repoName) {
            $log.debug("toggleWatched", repoName, repos[repoName]);
            if (watchedRepos[repoName]) {
                unwatchRepo(repoName);
            } else {
                watchRepo(repoName);
            }

        };

        var loadWatchedRepos = function() {
            try {
                return JSON.parse(sessionStorage.getItem("thWatchedRepos"));
            } catch (e) {
                // sessionStorage is disabled/not supported.
                return {};
            }
        };

        var saveWatchedRepos = function() {
            try {
                sessionStorage.setItem("thWatchedRepos", JSON.stringify(_.keys(watchedRepos)));
            } catch (e) {
                // sessionStorage is disabled/not supported.
            }
        };

        var getCurrentTreeStatus = function() {
            try {
                return repos[$rootScope.repoName].treeStatus.status;
            } catch(Exception) {
                return "unavailable";
            }
        };

        /**
         * if the repo isn't supported by treestatus, then these are the generic
         * values to use for it.
         * setting the value to 'unsupported' means that it won't bother checking
         * treestatus again for that repo when the interval does the updates.
         */
        var getUnsupportedTreeStatus = function(repoName) {
            return {
                status: "unsupported",
                message_of_the_day: repoName +
                    ' is not supported in <a href="https://api.pub.build.mozilla.org/treestatus">api.pub.build.mozilla.org/treestatus</a>',
                reason: "",
                tree: repoName
            };
        };

        /**
         * if there's an error fetching data from treestatus, make that obvious
         * in the treestatus field in treeherder
         */
        var getErrorTreeStatus = function(repoName) {
            return {
                status: "error",
                message_of_the_day: 'Error reaching <a href="https://api.pub.build.mozilla.org/treestatus">api.pub.build.mozilla.org/treestatus</a>',
                reason: 'Error reaching <a href="https://api.pub.build.mozilla.org/treestatus">api.pub.build.mozilla.org/treestatus</a>',
                tree: repoName
            };
        };

        /**
         * Update the status for ``repoName``.  If it's not passed in,
         * then update all ``watchedRepos`` status.
         * @param repoName
         * @returns a promise
         */
        var updateTreeStatus = function(repoName) {
            // The $interval will pass in the number of times it was called,
            // rather than a ``repoName``.  So repoName would equal 1, 2, 3.  So
            // if repoName isn't a valid watched repo, we update all.
            var repoNames = watchedRepos[repoName]? [repoName]: _.keys(watchedRepos);

            // filter out non-watched and unsupported repos to prevent repeatedly
            // hitting an endpoint we know will never work.
            repoNames = _.filter(repoNames, function(repo) {
                if (watchedRepos[repo] && watchedRepos[repo].treeStatus.status !== 'unsupported') {
                    return repo;
                }
            });
            var newStatuses = {};

            var getStatus = function(repo) {

                $log.debug("updateTreeStatus", "getStatus", "updating", repo);
                treeStatus.get(repo).then(
                    function(data) {
                        newStatuses[repo] = data.data.result;
                        updateStatusesIfDone();
                    },
                    function(data) {
                        if (data.data != null) {
                            newStatuses[repo] = getUnsupportedTreeStatus(repo);
                        } else {
                            newStatuses[repo] = getErrorTreeStatus(repo);
                        }
                        updateStatusesIfDone();
                    });

            };

            var updateStatusesIfDone = function() {
                if (_.size(newStatuses) === repoNames.length) {
                    // we've received all the statuses we expect to
                    _.defer(function() {
                        _.each(newStatuses, function(status) {
                            $log.debug("updateTreeStatus", "updateStatusesIfDone", status.tree, status.status);
                            watchedRepos[treeStatus.getRepoName(status.tree)].treeStatus = status;
                        });
                    });
                }
            };
            _.each(repoNames, getStatus);

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

            getOrderedRepoGroups: getOrderedRepoGroups,

            getCurrentTreeStatus: getCurrentTreeStatus,

            repos: repos,

            watchedRepos: watchedRepos,

            loadWatchedRepos: loadWatchedRepos,

            saveWatchedRepos: saveWatchedRepos,

            unwatchRepo: unwatchRepo,

            toggleWatched: toggleWatched

        };
    }]);
