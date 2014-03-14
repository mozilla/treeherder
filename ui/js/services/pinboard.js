'use strict';

treeherder.factory('thPinboard',
                   function($http, thUrl, ThJobClassificationModel, $rootScope,
                            thEvents, ThBugJobMapModel, thNotify) {

    var pinnedJobs = {};
    var relatedBugs = {};

    var saveClassification = function(job) {
        var classification = new ThJobClassificationModel(this);

        job.failure_classification_id = classification.failure_classification_id;

        classification.job_id = job.id;
        classification.create().
            success(function(data) {
                thNotify.send("classification saved for " + job.platform + ": " + job.job_type_name, "success");
            }).error(function(data) {
                thNotify.send("error saving classification for " + job.platform + ": " + job.job_type_name, "danger");
            });
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
                thNotify.send("bug association saved for " + job.platform + ": " + job.job_type_name, "success");
            }).error(function(data) {
                thNotify.send("error saving bug association for " + job.platform + ": " + job.job_type_name, "danger");
            });
            api.removeBug(bug.id);
        });
    };

    var api = {
        pinJob: function(job) {
            pinnedJobs[job.id] = job;
            api.count.numPinnedJobs = _.size(pinnedJobs);
        },

        unPinJob: function(id) {
            delete pinnedJobs[id];
            api.count.numPinnedJobs = _.size(pinnedJobs);
        },

        // clear all pinned jobs and related bugs
        unPinAll: function() {
            for (var jid in pinnedJobs) {
                if (pinnedJobs.hasOwnProperty(jid)) { delete pinnedJobs[jid]; } }
            for (var bid in relatedBugs) {
                if (relatedBugs.hasOwnProperty(bid)) { delete relatedBugs[bid]; } }
            api.count.numPinnedJobs = _.size(pinnedJobs);
        },

        addBug: function(bug) {
            relatedBugs[bug.id] = bug;
            api.count.numRelatedBugs = _.size(relatedBugs);
        },

        removeBug: function(id) {
            delete relatedBugs[id];
            api.count.numRelatedBugs = _.size(relatedBugs);
        },

        // open form to create a new note
        createNewClassification: function() {
            return new ThJobClassificationModel({
                note: "",
                who: null,
                failure_classification_id: -1
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
            $rootScope.$broadcast(thEvents.jobsClassified, {jobs: pinnedJobsClone});

            _.each(pinnedJobs, saveBugs);
            $rootScope.$broadcast(thEvents.bugsAssociated, {jobs: pinnedJobsClone});

            api.unPinAll();
        },

        // save the classification only on all pinned jobs
        saveClassificationOnly: function(classification) {
            _.each(pinnedJobs, saveClassification, classification);
            $rootScope.$broadcast(thEvents.jobsClassified, {jobs: pinnedJobs});
        },

        // save bug associations only on all pinned jobs
        saveBugsOnly: function() {
            if (!_.size(relatedBugs)) {
                thNotify.send("no bug associations to save");
            } else {
                _.each(pinnedJobs, saveBugs);
                $rootScope.$broadcast(thEvents.bugsAssociated, {jobs: pinnedJobs});
            }
        },

        hasPinnedJobs: function() {
            return !_.isEmpty(pinnedJobs);
        },
        pinnedJobs: pinnedJobs,
        relatedBugs: relatedBugs,
        count: {
            numPinnedJobs: 0,
            numRelatedBugs: 0
        }
    };

    return api;
});

