import treeFavicon from '../img/tree_open.png';
import closedTreeFavicon from '../img/tree_closed.png';
import { platformMap } from './constants';

treeherder.value("thPlatformMap", platformMap);

treeherder.value("thOptionOrder", {
    opt: 0,
    pgo: 1,
    asan: 2,
    tsan: 3,
    debug: 4,
    cc: 5,
    addon: 6
});

treeherder.value("thFailureResults", ["testfailed", "busted", "exception"]);

treeherder.value("thTitleSuffixLimit", 70);

treeherder.value("thFavicons", {
    closed: closedTreeFavicon,
    open: treeFavicon,
    "approval required": treeFavicon,
    unavailable: treeFavicon
});

treeherder.value("thRepoGroupOrder", {
    development: 1,
    "release-stabilization": 2,
    "project repositories": 3,
    "comm-repositories": 4,
    "qa automation tests": 5,
    try: 6,
    taskcluster: 7
});

treeherder.value("thDefaultRepo", "mozilla-inbound");

treeherder.value("thDateFormat", "EEE MMM d, HH:mm:ss");

treeherder.value("phCompareDefaultOriginalRepo", "mozilla-central");

treeherder.value("phCompareDefaultNewRepo", "try");

treeherder.value("phTimeRanges", [
      { value: 86400, text: "Last day" },
      { value: 86400*2, text: "Last 2 days" },
      { value: 604800, text: "Last 7 days" },
      { value: 1209600, text: "Last 14 days" },
      { value: 2592000, text: "Last 30 days" },
      { value: 5184000, text: "Last 60 days" },
      { value: 7776000, text: "Last 90 days" },
      { value: 31536000, text: "Last year" }]);

treeherder.value("phDefaultTimeRangeValue", 1209600);

treeherder.value("phTimeRangeValues", {
    "mozilla-beta": 7776000
});

treeherder.value("phBlockers", {
    "cart summary": 2.0,
    "damp summary": 2.0,
    "dromaeo_css summary": 2.0,
    "dromaeo_dom summary": 2.0,
    "glterrain summary": 5.0,
    "kraken summary": 2.0,
    sessionrestore: 5.0,
    sessionrestore_no_auto_restore: 5.0,
    "tart summary": 5.0,
    "tcanvasmark summary": 5.0,
    "tp5o % Processor Time": 2.0,
    "tp5o Main_RSS": 2.0,
    "tp5o Modified Page List Bytes": 2.0,
    "tp5o Private Bytes": 2.0,
    "tp5o XRes": 2.0,
    "tp5o responsiveness": 2.0,
    "tp5o summary": 5.0,
    "tp5o_scroll summary": 2.0,
    tpaint: 5.0,
    "tps summary": 5.0,
    tresize: 5.0,
    ts_paint: 2.0,
    tscrollx: 2.0,
    "tsvgr_opacity summary": 5.0,
    "tsvgx summary": 5.0
});

treeherder.value("phDefaultFramework", "talos");

treeherder.value("phAlertSummaryStatusMap", {
    UNTRIAGED: { id: 0, text: "untriaged" },
    DOWNSTREAM: { id: 1, text: "downstream" },
    REASSIGNED: { id: 2, text: "reassigned" },
    INVALID: { id: 3, text: "invalid" },
    IMPROVEMENT: { id: 4, text: "improvement" },
    INVESTIGATING: { id: 5, text: "investigating" },
    WONTFIX: { id: 6, text: "wontfix" },
    FIXED: { id: 7, text: "fixed" },
    BACKEDOUT: { id: 8, text: "backedout" }
});

treeherder.value("phAlertStatusMap", {
    UNTRIAGED: { id: 0, text: "untriaged" },
    DOWNSTREAM: { id: 1, text: "downstream" },
    REASSIGNED: { id: 2, text: "reassigned" },
    INVALID: { id: 3, text: "invalid" },
    ACKNOWLEDGED: { id: 4, text: "acknowledged" }
});

treeherder.value("phTalosDocumentationMap", {
    a11yr: "a11y",
    cart: "TART.2FCART",
    damp: "DAMP",
    dromaeo_css: "Dromaeo_Tests",
    dromaeo_dom: "Dromaeo_Tests",
    sessionrestore: "sessionrestore.2Fsessionrestore_no_auto_restore",
    sessionrestore_no_auto_restore: "sessionrestore.2Fsessionrestore_no_auto_restore",
    tart: "TART.2FCART",
    tcanvasmark: "CanvasMark",
    tp5n_main_normal_fileio: "xperf",
    tp5n_main_normal_netio: "xperf",
    tp5n_main_startup_fileio: "xperf",
    tp5n_main_startup_netio: "xperf",
    tp5n_nonmain_normal_fileio: "xperf",
    tp5n_nonmain_normal_netio: "xperf",
    tp5n_nonmain_startup_fileio: "xperf",
    tp5o: "tp5",
    "tp5o_% processor time": ".25_CPU",
    tp5o_main_rss: "RSS_.28Resident_Set_Size.29",
    "tp5o_modified page list bytes": "Modified_Page_List_Bytes",
    "tp5o_private bytes": "Private_Bytes",
    tp5o_xres: "Xres_.28X_Resource_Monitoring.29",
    tsvgr_opacity: "tsvg-opacity",
    v8_7: "V8.2C_version_7"
});

treeherder.value("phTrySyntaxBuildPlatformMap", {
    "android-4-0-armv7-api11": "android-api-11",
    "osx-10-10": "macosx64",
    "windows7-32": "win32",
    "windows8-64": "win64",
    windowsxp: "win32"
});

treeherder.value("phTrySyntaxTalosModifierMap", {
    "android-4-0-armv7-api11": "Android",
    "osx-10-10": "10.10",
    "windows7-32": "Windows 7",
    "windows8-64": "Windows 8",
    windowsxp: "Windows XP"
});

treeherder.value('mcTalosConfigUrl',
                 'https://hg.mozilla.org/mozilla-central/raw-file/tip/testing/talos/talos.json');

treeherder.value("thJobNavSelectors",
    {
        ALL_JOBS: {
            name: "jobs",
            selector: ".job-btn, .selected-job, .selected-count"
        },
        UNCLASSIFIED_FAILURES: {
            name: "unclassified failures",
            selector: ".selected-job, " +
                      ".selected-count, " +
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
