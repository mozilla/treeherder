'use strict';

treeherder.factory('thTabs', [
    function() {
        var thTabs = {
            "tabs": {
                "failureSummary": {
                    title: "Failure summary",
                    content: "plugins/failure_summary/main.html"
                },
                "annotations": {
                    title: "Annotations",
                    content: "plugins/annotations/main.html"
                },
                "similarJobs": {
                    title: "Similar jobs",
                    content: "plugins/similar_jobs/main.html"
                }
            },
            "selectedTab": "failureSummary",
            "showTab" : function(tab, contentId){
                thTabs.selectedTab = tab;
                // if the tab exposes an update function, call it
                // only refresh the tab if the content hasn't been loaded yet
                // or we don't have an identifier for the content loaded
                if(angular.isUndefined(thTabs.tabs[tab].contentId)
                    || thTabs.tabs[tab].contentId != contentId){
                    if(angular.isFunction(thTabs.tabs[tab].update)){
                        thTabs.tabs[tab].contentId = contentId;
                        thTabs.tabs[tab].update();
                    }
                }
            }
        };
        return thTabs;
    }
]);
