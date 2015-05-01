/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.factory('thTabs', [
    function() {
        var thTabs = {
            "tabs": {
                "failureSummary": {
                    title: "Failure summary",
                    content: "plugins/failure_summary/main.html",
                    enabled: true
                },
                "annotations": {
                    title: "Annotations",
                    content: "plugins/annotations/main.html",
                    enabled: true
                },
                "jobDetails": {
                    title: "Job details",
                    content: "plugins/job_details/main.html",
                    enabled: true
                },
                "similarJobs": {
                    title: "Similar jobs",
                    content: "plugins/similar_jobs/main.html",
                    enabled: true
                },
                "talos": {
                    title: "Job Info",
                    content: "plugins/talos/main.html",
                    enabled: false
                }
            },
            "selectedTab": "failureSummary",
            "showTab" : function(tab, contentId){
                thTabs.selectedTab = tab;
                if(!thTabs.tabs[thTabs.selectedTab].enabled){
                    thTabs.selectedTab = 'failureSummary';
                }
                // if the tab exposes an update function, call it
                // only refresh the tab if the content hasn't been loaded yet
                // or we don't have an identifier for the content loaded
                if(angular.isUndefined(thTabs.tabs[thTabs.selectedTab].contentId) ||
                    thTabs.tabs[thTabs.selectedTab].contentId !== contentId){
                    if(angular.isFunction(thTabs.tabs[thTabs.selectedTab].update)){
                        thTabs.tabs[thTabs.selectedTab].contentId = contentId;
                        thTabs.tabs[thTabs.selectedTab].update();
                    }
                }
            }
        };
        return thTabs;
    }
]);
