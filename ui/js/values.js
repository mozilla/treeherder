'use strict';

treeherder.value("thPlatformNameMap", {
    "linux32": "Linux",
    "linux64": "Linux x64",
    "osx-10-6": "OS X 10.6",
    "osx-10-7": "OS X 10.7",
    "osx-10-8": "OS X 10.8",
    "osx-10-9": "OS X 10.9",
    "osx-10-10": "OS X 10.10",
    "osx-10-11": "OS X 10.11",
    "windowsxp": "Windows XP",
    "windows7-32": "Windows 7",
    "windows7-64": "Windows 7 x64",
    "windows8-32": "Windows 8",
    "windows8-64": "Windows 8 x64",
    "windows10-32": "Windows 10",
    "windows10-64": "Windows 10 x64",
    "windows2012-64": "Windows 2012 x64",
    "android-2-2-armv6": "Android 2.2 Armv6",
    "android-2-2": "Android 2.2",
    "android-2-3-armv6": "Android 2.3 Armv6",
    "android-2-3": "Android 2.3",
    "android-2-3-armv7-api9": "Android 2.3 API9",
    "android-4-0": "Android 4.0",
    "android-4-0-armv7-api10": "Android 4.0 API10+",
    "android-4-0-armv7-api11": "Android 4.0 API11+",
    "android-4-0-armv7-api15": "Android 4.0 API15+",
    "android-4-2-x86": "Android 4.2 x86",
    "android-4-2": "Android 4.2",
    "android-4-2-armv7-api11": "Android 4.2 API11+",
    "android-4-2-armv7-api15": "Android 4.2 API15+",
    "android-4-3": "Android 4.3",
    "android-4-3-armv7-api11": "Android 4.3 API11+",
    "android-4-3-armv7-api15": "Android 4.3 API15+",
    "android-4-4": "Android 4.4",
    "android-4-4-armv7-api11": "Android 4.4 API11+",
    "android-4-4-armv7-api15": "Android 4.4 API15+",
    "android-5-0-armv7-api11": "Android 5.0 API11+",
    "android-5-0-armv7-api15": "Android 5.0 API15+",
    "b2gdroid-4-0-armv7-api11": "B2GDroid 4.0 API11+",
    "b2gdroid-4-0-armv7-api15": "B2GDroid 4.0 API15+",
    "android-4-0-armv7-api11-partner1": "Android API11+ partner1",
    "android-4-0-armv7-api15-partner1": "Android API15+ partner1",
    "b2g-linux32": "B2G Desktop Linux",
    "b2g-linux64": "B2G Desktop Linux x64",
    "b2g-osx": "B2G Desktop OS X",
    "b2g-win32": "B2G Desktop Windows",
    "b2g-emu-ics": "B2G ICS Emulator",
    "b2g-emu-jb": "B2G JB Emulator",
    "b2g-emu-kk": "B2G KK Emulator",
    "b2g-emu-x86-kk": "B2G KK Emulator x86",
    "b2g-emu-l": "B2G L Emulator",
    "b2g-device-image" : "B2G Device Image",
    "mulet-linux32" : "Mulet Linux",
    "mulet-linux64" : "Mulet Linux x64",
    "mulet-osx": "Mulet OS X",
    "mulet-win32": "Mulet Windows",
    "graphene-linux64": "Graphene Linux x64",
    "graphene-osx": "Graphene OS X",
    "graphene-win64": "Graphene Windows x64",
    "horizon-linux64": "Horizon Linux x64",
    "horizon-osx": "Horizon OS X",
    "horizon-win64": "Horizon Windows x64",
    "other": "Other"
});

treeherder.value("thPlatformOrder", {
    "linux32": 0,
    "linux64": 1,
    "osx-10-6": 10,
    "osx-10-7": 11,
    "osx-10-8": 12,
    "osx-10-9": 13,
    "osx-10-10": 14,
    "osx-10-11": 15,
    "windowsxp": 20,
    "windows7-32": 21,
    "windows7-64": 22,
    "windows8-32": 23,
    "windows8-64": 24,
    "windows10-32": 25,
    "windows10-64": 26,
    "windows2012-64": 27,
    "android-2-2-armv6": 30,
    "android-2-2": 31,
    "android-2-3-armv6": 32,
    "android-2-3": 33,
    "android-2-3-armv7-api9": 34,
    "android-4-0": 35,
    "android-4-0-armv7-api10": 36,
    "android-4-0-armv7-api11": 37,
    "android-4-0-armv7-api15": 38,
    "android-4-2-x86": 39,
    "android-4-2": 40,
    "android-4-2-armv7-api11": 41,
    "android-4-2-armv7-api15": 42,
    "android-4-3": 43,
    "android-4-3-armv7-api11": 44,
    "android-4-3-armv7-api15": 45,
    "android-4-4": 46,
    "android-4-4-armv7-api11": 47,
    "android-4-4-armv7-api15": 48,
    "android-5-0-armv7-api11": 49,
    "android-5-0-armv7-api15": 50,
    "b2gdroid-4-0-armv7-api11": 51,
    "b2gdroid-4-0-armv7-api15": 52,
    "android-4-0-armv7-api11-partner1": 53,
    "android-4-0-armv7-api15-partner1": 54,
    "b2g-linux32": 55,
    "b2g-linux64": 56,
    "b2g-osx": 57,
    "b2g-win32": 58,
    "b2g-emu-ics": 59,
    "b2g-emu-jb": 50,
    "b2g-emu-kk": 61,
    "b2g-emu-x86-kk": 62,
    "b2g-emu-l": 63,
    "b2g-device-image" : 64,
    "mulet-linux32" : 65,
    "mulet-linux64" : 66,
    "mulet-osx": 67,
    "mulet-win32": 68,
    "graphene-linux64": 71,
    "graphene-osx": 72,
    "graphene-win64": 73,
    "horizon-linux64": 74,
    "horizon-osx": 75,
    "horizon-win64": 76,
    "other": 99,
});

treeherder.value("thOptionOrder", {
    "opt": 0,
    "pgo": 1,
    "asan": 2,
    "tsan": 3,
    "debug": 4,
    "cc": 5,
    "addon": 6,
});

treeherder.value("thFailureResults", ["testfailed", "busted", "exception"]);

treeherder.value("thFavicons", {
    "closed": "img/tree_closed.png",
    "open": "img/tree_open.png",
    "approval required": "img/tree_open.png",
    "unavailable": "img/tree_open.png"
});

treeherder.value("thRepoGroupOrder", {
    "development": 1,
    "project repositories": 2,
    "try": 3,
    "release-stabilization": 4,
    "taskcluster": 5,
    "qa automation tests": 6
});

treeherder.value("thDefaultRepo", "mozilla-inbound");

treeherder.value("thDateFormat", "EEE MMM d, H:mm:ss");

treeherder.value("phCompareDefaultOriginalRepo", "mozilla-inbound");

treeherder.value("phCompareDefaultNewRepo", "try");

treeherder.value("phTimeRanges", [
      { "value":86400, "text": "Last day" },
      { "value":86400*2, "text": "Last 2 days" },
      { "value":604800, "text": "Last 7 days" },
      { "value":1209600, "text": "Last 14 days" },
      { "value":2592000, "text": "Last 30 days" },
      { "value":5184000, "text": "Last 60 days" },
      { "value":7776000, "text": "Last 90 days" },
      { "value":31536000, "text": "Last year" } ]);

treeherder.value("phDefaultTimeRangeValue", 1209600);

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
    "a11yr": "a11y",
    "cart": "TART.2FCART",
    "damp": "DAMP",
    "dromaeo_css": "Dromaeo_Tests",
    "dromaeo_dom": "Dromaeo_Tests",
    "sessionrestore": "sessionrestore.2Fsessionrestore_no_auto_restore",
    "sessionrestore_no_auto_restore": "sessionrestore.2Fsessionrestore_no_auto_restore",
    "tart": "TART.2FCART",
    "tcanvasmark": "CanvasMark",
    "tp5n_main_normal_fileio": "xperf",
    "tp5n_main_normal_netio": "xperf",
    "tp5n_main_startup_fileio": "xperf",
    "tp5n_main_startup_netio": "xperf",
    "tp5n_nonmain_normal_fileio": "xperf",
    "tp5n_nonmain_normal_netio": "xperf",
    "tp5n_nonmain_startup_fileio": "xperf",
    "tp5o": "tp5",
    "tp5o_% processor time": ".25_CPU",
    "tp5o_main_rss": "RSS_.28Resident_Set_Size.29",
    "tp5o_modified page list bytes": "Modified_Page_List_Bytes",
    "tp5o_private bytes": "Private_Bytes",
    "tp5o_xres": "Xres_.28X_Resource_Monitoring.29",
    "tsvgr_opacity": "tsvg-opacity",
    "v8_7": "V8.2C_version_7",
});

treeherder.value("phTrySyntaxBuildPlatformMap", {
    "android-4-0-armv7-api11": "android-api-11",
    "osx-10-10": "macosx64",
    "windows7-32": "win32",
    "windows8-64": "win64",
    "windowsxp": "win32"
});

treeherder.value("phTrySyntaxTalosModifierMap", {
    "android-4-0-armv7-api11": "Android",
    "osx-10-10": "10.10",
    "windows7-32": "Windows 7",
    "windows8-64": "Windows 8",
    "windowsxp": "Windows XP"
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
            selector: ".selected-job, .selected-count, " +
                      ".job-btn.btn-red, " +
                      ".job-btn.btn-orange, " +
                      ".job-btn.btn-purple"
        }
    }
);

treeherder.value("thPerformanceBranches", [
    "mozilla-inbound", "mozilla-central", "fx-team"
]);
