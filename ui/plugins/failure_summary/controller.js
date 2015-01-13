/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', 'ThLog', 'ThJobArtifactModel','$q', 'thTabs',
    function BugsPluginCtrl(
        $scope, ThLog, ThJobArtifactModel, $q, thTabs) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        var timeout_promise = null;
        var bug_limit = 20;
        $scope.tabs = thTabs.tabs;

        // update function triggered by the plugins controller
        thTabs.tabs.failureSummary.update = function(){
            var newValue = thTabs.tabs.failureSummary.contentId;
            $scope.suggestions = [];
            if(angular.isDefined(newValue)){
                thTabs.tabs.failureSummary.is_loading = true;
                // if there's a ongoing request, abort it
                if (timeout_promise !== null) {
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();

                ThJobArtifactModel.get_list({
                    name: "Bug suggestions",
                    "type": "json",
                    job_id: newValue
                }, {timeout: timeout_promise})
                .then(function(artifact_list){
                    // using a temporary array here to not trigger a
                    // dirty check for every element pushed
                    var suggestions = [];
                    if(artifact_list.length > 0){
                        var artifact = artifact_list[0];
                        angular.forEach(artifact.blob, function (suggestion) {
                            suggestion.bugs.too_many_open_recent = (
                                suggestion.bugs.open_recent.length > bug_limit
                            );
                            suggestion.bugs.too_many_all_others = (
                                suggestion.bugs.all_others.length > bug_limit
                            );
                            suggestion.open_recent_hidden = (
                                suggestion.bugs.too_many_open_recent ||
                                suggestion.bugs.open_recent.length === 0
                            );

                            suggestion.all_others_hidden = (
                                suggestion.bugs.too_many_all_others ||
                                suggestion.bugs.all_others.length === 0
                            );

                            suggestions.push(suggestion);
                        });
                        $scope.suggestions = suggestions;
                    }
                })
                .finally(function () {
                    thTabs.tabs.failureSummary.is_loading = false;
                });
            }
        };
    }
]);
