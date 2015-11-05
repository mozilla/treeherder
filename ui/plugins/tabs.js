'use strict';

treeherder.factory('thTabs', [
    function() {
        var thTabs = {
            "tabs": {
                "jobDetails": {
                    title: "Job details",
                    description: "additional job information",
                    content: "plugins/job_details/main.html",
                    enabled: true
                },
                "failureSummary": {
                    title: "Failure summary",
                    description: "failure summary",
                    content: "plugins/failure_summary/main.html",
                    enabled: true
                },
                "annotations": {
                    title: "Annotations",
                    description: "annotations",
                    content: "plugins/annotations/main.html",
                    enabled: true
                },
                "similarJobs": {
                    title: "Similar jobs",
                    description: "similar jobs",
                    content: "plugins/similar_jobs/main.html",
                    enabled: true
                },
                "talos": {
                    title: "Talos",
                    description: "Talos job details",
                    content: "plugins/talos/main.html",
                    enabled: false
                }
            },
            "tabOrder": [
                "jobDetails",
                "failureSummary",
                "annotations",
                "similarJobs",
                "talos"
            ],
            "selectedTab": "jobDetails",
            "showTab" : function(tab, contentId){
                thTabs.selectedTab = tab;
                if(!thTabs.tabs[thTabs.selectedTab].enabled){
                    thTabs.selectedTab = 'jobDetails';
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
