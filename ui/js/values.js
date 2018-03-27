import treeherder from './treeherder';

treeherder.value("thPerformanceBranches", [
    "autoland", "mozilla-inbound"
]);

treeherder.value("phDashboardValues",
    {
        /*
        Expected dashboard configs structure:
        <dashboard_name>: {
            baseTitle: string,
            defaultRepo: string,
            descP1: string,
            descP2: string,
            framework: integer,
            header: string,
            linkDesc: string,
            linkUrl: urlString,
            variantDataOpt: string,
            variantTitle: string
         }, ...
         */
    }
);

treeherder.value('compareBaseLineDefaultTimeRange', 86400 * 2);

treeherder.constant('thPinboardCountError', "Max pinboard size of 500 reached.");
