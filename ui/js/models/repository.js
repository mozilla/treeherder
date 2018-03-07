import treeherder from '../treeherder';
import { getRootUrl } from '../../helpers/urlHelper';

treeherder.factory('ThRepositoryModel', [
    '$http', '$rootScope', '$interval',
    '$q', 'treeStatus', 'thRepoGroupOrder',
    function (
        $http, $rootScope, $interval, $q,
        treeStatus, thRepoGroupOrder) {

        const repos = {};
        const watchedRepos = [];
        const orderedRepoGroups = {};
        const maxWatchedRepos = 3;

        // get the repositories (aka trees)
        // sample: 'resources/menu.json'
        const getByName = function (name) {
            if ($rootScope.repos !== undefined) {
                for (let i = 0; i < $rootScope.repos.length; i++) {
                    const repo = $rootScope.repos[i];
                    if (repo.name === name) {
                        return repo;
                    }
                }
            }
            return null;
        };


        const getOrderedRepoGroups = function () {
            if (!_.size(orderedRepoGroups)) {
                const groups = _.groupBy($rootScope.repos, function (r) { return r.repository_group.name; });
                _.each(groups, function (reposAr, gName) {
                    orderedRepoGroups[thRepoGroupOrder[gName] || gName] = { name: gName, repos: reposAr };
                });
            }
            return orderedRepoGroups;
        };

        /**
         * if the repo isn't supported by treestatus, then these are the generic
         * values to use for it.
         * setting the value to 'unsupported' means that it won't bother checking
         * treestatus again for that repo when the interval does the updates.
         */
        const getUnsupportedTreeStatus = function (repoName) {
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
        const getErrorTreeStatus = function (repoName) {
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
        const updateTreeStatus = function (repoName) {
            // The $interval will pass in the number of times it was called,
            // rather than a ``repoName``.  So repoName would equal 1, 2, 3.  So
            // if repoName isn't a valid watched repo, we update all.
            let repoNames = watchedRepos.indexOf(repoName) !== -1 ? [repoName] : watchedRepos;

            // filter out non-watched and unsupported repos to prevent repeatedly
            // hitting an endpoint we know will never work.
            repoNames = repoNames.filter(repo => watchedRepos.indexOf(repo) !== -1 && repos[repo].treeStatus.status !== 'unsupported');
            const newStatuses = {};

            const updateStatusesIfDone = function () {
                if (_.size(newStatuses) === repoNames.length) {
                    // we've received all the statuses we expect to
                    _.defer(function () {
                        _.each(newStatuses, function (status) {
                            repos[treeStatus.getRepoName(status.tree)].treeStatus = status;
                        });
                    });
                }
            };

            const getStatus = function (repo) {
                treeStatus.get(repo).then(
                    function (data) {
                        newStatuses[repo] = data.data.result;
                        updateStatusesIfDone();
                    },
                    function (data) {
                        if (data.data !== null) {
                            newStatuses[repo] = getUnsupportedTreeStatus(repo);
                        } else {
                            newStatuses[repo] = getErrorTreeStatus(repo);
                        }
                        updateStatusesIfDone();
                    });
            };

            _.each(repoNames, getStatus);
        };

        const addRepoAsUnwatched = function (repo) {
            repos[repo.name] = {
                treeStatus: null,
                unclassifiedFailureCount: 0,
                groupName: repo.repository_group.name
            };
        };

        const loadWatchedRepos = function () {
            try {
                return JSON.parse(localStorage.getItem("thWatchedRepos"));
            } catch (e) {
                // localStorage is disabled/not supported.
                return [];
            }
        };

        const saveWatchedRepos = function () {
            try {
                localStorage.setItem("thWatchedRepos", JSON.stringify(watchedRepos));
            } catch (e) {
                // localStorage is disabled/not supported.
            }
        };

        /**
         * We want to add this repo as watched, but we also
         * want to get the treestatus for it
         */
        const watchRepo = function (name) {
            // Safeguard: Don't allow duplicates in the watch list
            // Also, only add items for which we have data for
            if (watchedRepos.indexOf(name) !== -1 || !repos[name]) {
                return;
            }
            _.extend(repos[name], {
                treeStatus: { status: "not retrieved yet", message_of_the_day: "" },
                unclassifiedFailureCount: 0,
                groupName: repos[name].groupName
            });
            watchedRepos.unshift(name);
            updateTreeStatus(name);
            // Limit to maxiumum saved repos at a time
            if (watchedRepos.length > maxWatchedRepos) {
                watchedRepos.length = maxWatchedRepos;
            }
            saveWatchedRepos();
        };

        const unwatchRepo = function (name) {
            const pos = watchedRepos.indexOf(name);
            if (pos > -1) {
                watchedRepos.splice(pos, 1);
            }
            saveWatchedRepos();
        };

        const get_uri = function () {
            return getRootUrl("/repository/");
        };

        const get_list = function () {
            return $http.get(get_uri(), { cache: true });
        };

        const getCurrent = function () {
            return $rootScope.currentRepo;
        };

        const setCurrent = function (name) {
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

            }
        };

        const load = function (options) {
            options = options || {};

            if (!$rootScope.repos) {
                // this is the first time this was called, so initiate the interval
                // update the repo status (treestatus) in an interval of every 2 minutes
                $interval(updateTreeStatus, 2 * 60 * 1000);

                // return the promise of getting the repos
                return get_list()
                    .then(({ data }) => {
                        // FIXME: only supporting github + hg for now for pushlog
                        // + revision info (we also assume dvcs_type git===github)
                        function Repo(props) {
                            _.assign(this, props);
                            if (this.dvcs_type === 'git') {
                                // FIXME: assuming master branch, which may not
                                // always be right -- unfortunately fixing this
                                // requires backend changes as we're not storing
                                // such info explicitly right now
                                this.pushlogURL = this.url + "/commits/master";
                            } else {
                                this.pushlogURL = this.url + "/pushloghtml";
                            }
                        }
                        Repo.prototype = {
                            getRevisionHref: function (revision) {
                                if (this.dvcs_type === 'git') {
                                    return this.url + '/commit/' + revision;
                                }
                                return this.url + '/rev/' + revision;
                            },
                            getPushLogHref: function (arg) {
                                if (this.dvcs_type === 'git') {
                                    // if git, assume github
                                    if (typeof (arg) === 'string') {
                                        return this.getRevisionHref(arg);
                                    } else if (arg && arg.from && arg.to) {
                                        return this.url + '/compare/' + arg.from + '...' +
                                            arg.to;
                                    }
                                } else if (this.dvcs_type === 'hg') {
                                    if (typeof (arg) === 'string') {
                                        return this.pushlogURL + '?changeset=' + arg;
                                    } else if (arg && arg.from && arg.to) {
                                        return this.pushlogURL + '?fromchange=' +
                                            arg.from +'&tochange=' + arg.to;
                                    }
                                }

                                // if neither git nor mercurial, undefined
                                return "";
                            }
                        };

                        $rootScope.repos = _.map(data, function (datum) {
                            return new Repo(datum);
                        });

                        _.each(data, addRepoAsUnwatched);

                        // This needs to be done before `setCurrent` because
                        // `setCurrent` overwrites the entire listing
                        // with only the default repo
                        let storedWatched;
                        if (options.watchRepos) {
                            storedWatched = loadWatchedRepos();
                        }

                        if (options.name) {
                            setCurrent(options.name);
                        }
                        if (options.watchRepos) {
                            if (_.isArray(storedWatched)) {

                                // To get the current repo to display first, we must
                                // ensure it's added to the array last, as per normal user interaction
                                storedWatched = _.without(storedWatched, options.name);
                                unwatchRepo(options.name);

                                // Add the repos in reverse order, like the user would (oldest to newest)
                                storedWatched.reverse();
                                storedWatched.push(options.name);

                                _.each(storedWatched, function (repo) {
                                    watchRepo(repo);
                                });
                            }
                            saveWatchedRepos();
                        }
                    });
            }

            if (options.name) {
                setCurrent(options.name);
            }
            return $q(function (resolve) {
                resolve('Already loaded');
            });
        };

        const toggleWatched = function (repoName) {
            if (watchedRepos[repoName]) {
                unwatchRepo(repoName);
            } else {
                watchRepo(repoName);
            }

        };

        const getCurrentTreeStatus = function () {
            try {
                return repos[$rootScope.repoName].treeStatus.status;
            } catch (Exception) {
                return "unavailable";
            }
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
