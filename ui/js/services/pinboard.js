treeherder.factory('thPinboard', [
    'ThJobClassificationModel', '$rootScope', 'thEvents',
    'ThBugJobMapModel', 'thNotify', 'ThModelErrors', 'ThResultSetStore', 'thPinboardCountError',
    function (
        ThJobClassificationModel, $rootScope, thEvents,
        ThBugJobMapModel, thNotify, ThModelErrors, ThResultSetStore, thPinboardCountError) {

        var pinnedJobs = {};
        var relatedBugs = {};

        var saveClassification = function (job) {
            var classification = new ThJobClassificationModel(this);

            // classification can be left unset making this a no-op
            if (classification.failure_classification_id > 0) {
                job.failure_classification_id = classification.failure_classification_id;

                // update the unclassified failure count for the page
                ThResultSetStore.updateUnclassifiedFailureMap(job);

                classification.job_id = job.id;
                classification.create()
                    .then(() => {
                        thNotify.send("Classification saved for " + job.platform + " " + job.job_type_name, "success");
                    }).catch((response) => {
                        var message = "Error saving classification for " + job.platform + " " + job.job_type_name;
                        thNotify.send(
                            ThModelErrors.format(response, message),
                            "danger"
                        );
                    });
            }
        };

        var saveBugs = function (job) {
            Object.values(relatedBugs).forEach(function (bug) {
                var bjm = new ThBugJobMapModel({
                    bug_id: bug.id,
                    job_id: job.id,
                    type: 'annotation'
                });
                bjm.create()
                    .then(() => {
                        thNotify.send("Bug association saved for " + job.platform + " " + job.job_type_name, "success");
                    }).catch((response) => {
                        var message = "Error saving bug association for " + job.platform + " " + job.job_type_name;
                        thNotify.send(
                            ThModelErrors.format(response, message),
                            "danger"
                        );
                    });
            });
        };

        var api = {
            toggleJobPin: function (job) {
                if (pinnedJobs[job.id]) {
                    api.unPinJob(job.id);
                } else {
                    api.pinJob(job);
                }
            },

            pinJob: function (job) {
                if (api.spaceRemaining() > 0) {
                    pinnedJobs[job.id] = job;
                    api.count.numPinnedJobs = _.size(pinnedJobs);
                    $rootScope.$emit(thEvents.pulsePinCount);
                } else {
                    thNotify.send(thPinboardCountError, 'danger');
                }
            },

            pinJobs: function (jobsToPin) {
                jobsToPin.forEach(api.pinJob);
            },

            unPinJob: function (id) {
                delete pinnedJobs[id];
                api.count.numPinnedJobs = _.size(pinnedJobs);
            },

            // clear all pinned jobs and related bugs
            unPinAll: function () {
                for (var jid in pinnedJobs) {
                    if (pinnedJobs.hasOwnProperty(jid)) { delete pinnedJobs[jid]; }
                }
                for (var bid in relatedBugs) {
                    if (relatedBugs.hasOwnProperty(bid)) { delete relatedBugs[bid]; }
                }
                api.count.numPinnedJobs = _.size(pinnedJobs);
            },

            addBug: (bug, job) => {
                relatedBugs[bug.id] = bug;
                api.count.numRelatedBugs = _.size(relatedBugs);

                if (job) {
                    api.pinJob(job);
                }
            },

            removeBug: function (id) {
                delete relatedBugs[id];
                api.count.numRelatedBugs = _.size(relatedBugs);
            },

            // open form to create a new note. default to intermittent
            createNewClassification: function () {
                return new ThJobClassificationModel({
                    text: "",
                    who: null,
                    failure_classification_id: 4
                });
            },

            // save the classification and related bugs to all pinned jobs
            save: function (classification) {

                var pinnedJobsClone = {};
                var jid;
                for (jid in pinnedJobs) {
                    if (pinnedJobs.hasOwnProperty(jid)) {
                        pinnedJobsClone[jid] = pinnedJobs[jid];
                    }
                }

                _.each(pinnedJobs, _.bind(saveClassification, classification));
                $rootScope.$emit(thEvents.jobsClassified, { jobs: pinnedJobsClone });

                _.each(pinnedJobs, saveBugs);
                $rootScope.$emit(thEvents.bugsAssociated, { jobs: pinnedJobsClone });

                api.unPinAll();
            },

            // save the classification only on all pinned jobs
            saveClassificationOnly: function (classification) {
                _.each(pinnedJobs, _.bind(saveClassification, classification));
                $rootScope.$emit(thEvents.jobsClassified, { jobs: pinnedJobs });
            },

            // save bug associations only on all pinned jobs
            saveBugsOnly: function () {
                _.each(pinnedJobs, saveBugs);
                $rootScope.$emit(thEvents.bugsAssociated, { jobs: pinnedJobs });
            },

            hasPinnedJobs: function () {
                return !_.isEmpty(pinnedJobs);
            },

            hasRelatedBugs: function () {
                return !_.isEmpty(relatedBugs);
            },

            spaceRemaining: function () {
                return api.maxNumPinned - api.count.numPinnedJobs;
            },

            isPinned: function (job) {
                return pinnedJobs.hasOwnProperty(job.id);
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

