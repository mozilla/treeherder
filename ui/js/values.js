import treeherder from './treeherder';

treeherder.value("phAlertSummaryIssueTrackersMap", {
    BUGZILLA: { id: 1, text: "Bugzilla", issueTrackerUrl: "https://bugzilla.mozilla.org/show_bug.cgi?id=" },
    GITHUB_SERVO: { id: 2, text: "Github - Servo", issueTrackerUrl: "https://github.com/servo/servo/pull/" }
});

treeherder.value("phAlertStatusMap", {
    UNTRIAGED: { id: 0, text: "untriaged" },
    DOWNSTREAM: { id: 1, text: "downstream" },
    REASSIGNED: { id: 2, text: "reassigned" },
    INVALID: { id: 3, text: "invalid" },
    ACKNOWLEDGED: { id: 4, text: "acknowledged" }
});

treeherder.value("thJobNavSelectors",
    {
        ALL_JOBS: {
            name: "jobs",
            selector: ".job-btn, .selected-job"
        },
        UNCLASSIFIED_FAILURES: {
            name: "unclassified failures",
            selector: ".selected-job, " +
                      ".job-btn.btn-red, " +
                      ".job-btn.btn-orange, " +
                      ".job-btn.btn-purple, " +
                      ".job-btn.autoclassified"
        }
    }
);

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
