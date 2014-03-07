'use strict';

treeherder.factory('thPinboard',
                   ['$http', 'thUrl', 'ThJobClassificationModel', '$rootScope',
                   function($http, thUrl, ThJobClassificationModel, $rootScope) {

    var pinnedJobs = {};
    var relatedBugs = {};
    var newClassification;

    var api = {
        pinJob: function(job) {
            pinnedJobs[job.id] = job;
            // update the ui because these are added outside the angular event
            // model.
            $rootScope.$apply();
        },

        unPinJob: function(id) {
            delete pinnedJobs[id];
        },

        unPinAll: function() {
            for (var id in pinnedJobs) {
                if (pinnedJobs.hasOwnProperty(id)) { delete pinnedJobs[id]; } }
        },

        addBug: function(bug) {
            relatedBugs[bug.id] = bug;
        },

        removeBug: function(id) {
            delete relatedBugs[id];
        },

        // open form to create a new note
        createNewClassification: function(username) {
            var fci = 0;
            newClassification = new ThJobClassificationModel({
                note: "",
                who: username,
                failure_classification_id: fci
            });
            return newClassification;
//            $scope.focusInput=true;
        },

        // done adding a new note, so clear and hide the form
        clearNewClassification: function() {
            newClassification = null;
        },

        // save the classification to all pinned jobs
        saveNewClassification: function() {
            // add job_id to the ThJobClassificationModel.
//            job_id: $scope.job.id,

//            $scope.newBatchClassification.create()
//                .then(function(response){
//                    $scope.updateclassifications();
//                    $scope.clearNewNote();
//                });
        },

        hasPinnedJobs: function() {
            return !_.isEmpty(pinnedJobs);
        },
        pinnedJobs: pinnedJobs,
        relatedBugs: relatedBugs
    };

    return api;
}]);

