'use strict';

treeherder.factory('thPinboard', [
    '$http', 'thUrl', 'ThJobClassificationModel', '$rootScope', 'thEvents',
    'ThBugJobMapModel', 'thNotify', 'ThLog', 'ThResultSetStore',
    function(
        $http, thUrl, ThJobClassificationModel, $rootScope, thEvents,
        ThBugJobMapModel, thNotify, ThLog, ThResultSetStore) {

        var $log = new ThLog("thPinboard");

        var pinnedJobs = {};
        var relatedBugs = {};

        var saveClassification = function(job) {
            var classification = new ThJobClassificationModel(this);

            // classification can be left unset making this a no-op
            if (classification.failure_classification_id > 0) {
                job.failure_classification_id = classification.failure_classification_id;

                // update the unclassified failure count for the page
                ThResultSetStore.updateUnclassifiedFailureMap($rootScope.repoName, job);

                classification.job_id = job.id;
                classification.create().
                    success(function(data) {
                        thNotify.send("Classification saved for " + job.platform + ": " + job.job_type_name, "success");
                    }).error(function(data) {
                        thNotify.send("Error saving classification for " + job.platform + ": " + job.job_type_name, "danger");
                        $log.debug("classification failed", data);
                    });
            }
        };

        var saveBugs = function(job) {
            _.forEach(relatedBugs, function(bug) {
                var bjm = new ThBugJobMapModel({
                    bug_id : bug.id,
                    job_id: job.id,
                    type: 'annotation'
                });
                bjm.create().
                    success(function(data) {
                        thNotify.send("Bug association saved for " + job.platform + ": " + job.job_type_name, "success");
                    }).error(function(data) {
                        thNotify.send("Error saving bug association for " + job.platform + ": " + job.job_type_name, "danger");
                    });
            });
        };

        var api = {
            toggleJobPin: function(job) {
                if(pinnedJobs[job.id]) {
                    api.unPinJob(job.id);
                } else {
                    api.pinJob(job);
                }
            },

            pinJob: function(job) {
                if (api.spaceRemaining() > 0) {
                    pinnedJobs[job.id] = job;
                    api.count.numPinnedJobs = _.size(pinnedJobs);
                } else {
                    thNotify.send("Pinboard is already at maximum size of " + api.maxNumPinned,
                                  "danger");
                }
            },

            pinJobs: function(jobsToPin) {
                _.forEach(jobsToPin, api.pinJob);
            },

            unPinJob: function(id) {
                delete pinnedJobs[id];
                api.count.numPinnedJobs = _.size(pinnedJobs);
            },

            // clear all pinned jobs and related bugs
            unPinAll: function() {
                for (var jid in pinnedJobs) {
                    if (pinnedJobs.hasOwnProperty(jid)) { delete pinnedJobs[jid]; }
                }
                for (var bid in relatedBugs) {
                    if (relatedBugs.hasOwnProperty(bid)) { delete relatedBugs[bid]; }
                }
                api.count.numPinnedJobs = _.size(pinnedJobs);
            },

            addBug: function(bug, job) {
                $log.debug("adding bug ", bug);
                relatedBugs[bug.id] = bug;
                api.count.numRelatedBugs = _.size(relatedBugs);
                $log.debug("related bugs", relatedBugs);
                if (job) {
                    api.pinJob(job);
                }

            },

            removeBug: function(id) {
                delete relatedBugs[id];
                api.count.numRelatedBugs = _.size(relatedBugs);
            },

            // open form to create a new note. default to intermittent
            createNewClassification: function() {
                return new ThJobClassificationModel({
                    text: "",
                    who: null,
                    failure_classification_id: 4
                });
            },

            // save the classification and related bugs to all pinned jobs
            save: function(classification) {

                var pinnedJobsClone = {};
                var jid;
                for (jid in pinnedJobs) {
                    if (pinnedJobs.hasOwnProperty(jid)) {
                        pinnedJobsClone[jid] = pinnedJobs[jid];
                    }
                }

                _.each(pinnedJobs, saveClassification, classification);
                $rootScope.$emit(thEvents.jobsClassified, {jobs: pinnedJobsClone});

                _.each(pinnedJobs, saveBugs);
                $rootScope.$emit(thEvents.bugsAssociated, {jobs: pinnedJobsClone});

                api.unPinAll();
            },

            // save the classification only on all pinned jobs
            saveClassificationOnly: function(classification) {
                _.each(pinnedJobs, saveClassification, classification);
                $rootScope.$emit(thEvents.jobsClassified, {jobs: pinnedJobs});
            },

            // save bug associations only on all pinned jobs
            saveBugsOnly: function() {
                _.each(pinnedJobs, saveBugs);
                $rootScope.$emit(thEvents.bugsAssociated, {jobs: pinnedJobs});
            },

            hasPinnedJobs: function() {
                return !_.isEmpty(pinnedJobs);
            },

            hasRelatedBugs: function() {
                return !_.isEmpty(relatedBugs);
            },

            spaceRemaining: function() {
                return api.maxNumPinned - api.count.numPinnedJobs;
            },

            pinnedJobs: pinnedJobs,
            relatedBugs: relatedBugs,
            count: {
                numPinnedJobs: 0,
                numRelatedBugs: 0
            },
            // not sure what this should be, but we need some limit, I think.
            maxNumPinned: 500
        };

        return api;
    }]);

