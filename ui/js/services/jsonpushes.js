'use strict';

treeherder.service('JsonPushes', ['$http', '$q', function($http, $q) {
    // error handler helper
    var prevRevsErrHandler = function(response) {
        if (response instanceof Error) {
            return $q.reject("Unable to find a previous revision" +
                             " (" + response + ").");
        } else {
            // http error
            return $q.reject("Error " + response.status +
                             " (" + response.data + ").");
        }
    };

    /* *recursive* attempts to find the nearest branch and revision for a
       revision that have a child present in another branch (e.g., find the
       previous revision from try).

     The logic is the following:

     1. use `revision` and `project` to find the oldest changeset in the
        push containing `revision`
     2. find the parent of that revision
     3. search in other `projects` the presence of that parent revision
     4. If we find it, we are done. Else go to 1. using the parent revision
        for the new `revision`.
     */
    var _getPreviousRevisionFrom = function(project, revision, projects,
                                            defer, attempt, maxAttempts) {
        if (attempt >= maxAttempts) {
            defer.reject(new Error("Maximum recursion attempts exceeded"));
            return;
        }

        // find the parent changeset
        $http.get(
            project.url + "/json-rev/" + revision
        ).then(function(response) {
            return response.data.parents[0];
        }).then(function(parentChset) {
            // now check in projects if we can find the parent changeset
            var promises = _.map(projects, function (proj) {
                return $q(function(resolve) {
                    $http.get(
                        proj.url + "/json-pushes?changeset=" + parentChset
                    ).then(function(response) {
                        var pushId = _.keys(response.data)[0];
                        var chsets = response.data[pushId].changesets;
                        return {
                            revision: chsets[chsets.length - 1],
                            date: response.data[pushId].date
                        };
                    }).then(
                        // we found something!
                        function(data) {
                            resolve({
                                project: proj,
                                revision: data.revision,
                                date: data.date
                            });
                        }, function() {
                            // swallow all errors so $q.all will succeed
                            resolve(null);
                        }
                    );
                });
            });
            return $q.all(promises).then(
                function(results) {
                    results = _.filter(results);
                    if (results.length === 0) {
                        // nothing found - try with the parent of the parent
                        setTimeout(function() {
                            _getPreviousRevisionFrom(project, parentChset,
                                                     projects, defer,
                                                     attempt + 1, maxAttempts);
                        }, 0);
                    } else {
                        defer.resolve(results);
                    }
                }
            );
        }, defer.reject);
    };

    return {
        /**
         * Return the previous revision (on the previous push) given one
         * revision on a project.
         **/
        getPreviousRevision: function(project, revision) {
            return $http.get(
                project.url + "/json-pushes?changeset=" + revision
            ).then(function(response) {
                // get the pushid of this changeset
                return _.keys(response.data)[0];
            }).then(function(pushId) {
                // and now get the changeset of pushid - 1
                pushId = parseInt(pushId);
                // pushlog API do not include the endId pushId - so we ask
                // between [pushId - 2, pushId - 1]
                return $http.get(project.url +
                                 "/json-pushes?startID=" + (pushId - 2) +
                                 "&endID=" + (pushId - 1));
            }).then(
                function (response) {
                    var pushId = _.keys(response.data)[0];
                    var chsets = response.data[pushId].changesets;
                    // the most recent changeset is the changeset associated
                    // to a push
                    return chsets[chsets.length - 1];
                },
                prevRevsErrHandler
            );
        },

        /**
         * Return an object that contain the push revision and the project
         * found as being the previous revision on another project.
         *
         * project: project in which we know the revision (e.g., try)
         * revision: the revision we know
         * projects: a list of projects inw which we should search
         *           (m-i/fx-team/...)
         */
        getPreviousRevisionFrom: function(project, revision, projects) {
            var deferred = $q.defer();

            $http.get(
                project.url + "/json-pushes?changeset=" + revision
            ).then(function(response) {
                // find the oldest changeset in the push
                var pushId = _.keys(response.data)[0];
                return response.data[pushId].changesets[0];
            }).then(function(oldRev) {
                _getPreviousRevisionFrom(project, oldRev, projects, deferred,
                                         // attempt, maxAttempts
                                         0, 7);
            }, deferred.reject);

            return deferred.promise.then(
                function(results) {
                    // return the changeset with the lowest push date
                    // with some luck, it does not comes from a merge.
                    return _.sortBy(results, function(r) {
                        return r.date;
                    })[0];
                },
                prevRevsErrHandler
            );
        }
    };
}]);
