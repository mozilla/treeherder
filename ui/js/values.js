'use strict';

treeherder.value("thPlatformMap", {
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
    "windows7-32-vm": "Windows 7 VM",
    "windows7-64": "Windows 7 x64",
    "windows8-32": "Windows 8",
    "windows8-64": "Windows 8 x64",
    "windows10-32": "Windows 10",
    "windows10-64": "Windows 10 x64",
    "windows10-64-vm": "Windows 10 x64 VM",
    "windows2012-32": "Windows 2012",
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
    "android-5-1-armv7-api15": "Android 5.1 API15+",
    "android-6-0-armv8-api15": "Android 6.0 API15+",
    "b2gdroid-4-0-armv7-api11": "B2GDroid 4.0 API11+",
    "b2gdroid-4-0-armv7-api15": "B2GDroid 4.0 API15+",
    "android-4-0-armv7-api11-partner1": "Android API11+ partner1",
    "android-4-0-armv7-api15-partner1": "Android API15+ partner1",
    "android-api-15-gradle": "Android API15+ Gradle",

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

    "gecko-decision": "Gecko Decision Task",
    "other": "Other",
});

treeherder.value("thOptionOrder", {
    "opt": 0,
    "pgo": 1,
    "asan": 2,
    "tsan": 3,
    "debug": 4,
    "cc": 5,
    "addon": 6
});

treeherder.value("thFailureResults", ["testfailed", "busted", "exception"]);

treeherder.value("thTitleSuffixLimit", 70);

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

treeherder.value("phComparisonDate", [
    { "value":0, "text": "Today" },
    { "value":604800, "text": "1 week ago" },
    { "value":1209600, "text": "2 weeks ago" },
    { "value":2419200, "text": "4 weeks ago" },
    { "value":3628800, "text": "6 weeks ago" }
]);

treeherder.value("phBlockers", {
    "cart summary": 2.0,
    "damp summary": 2.0,
    "dromaeo_css summary": 2.0,
    "dromaeo_dom summary": 2.0,
    "glterrain summary": 5.0,
    "kraken summary": 2.0,
    "sessionrestore": 5.0,
    "sessionrestore_no_auto_restore": 5.0,
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
    "tpaint": 5.0,
    "tps summary": 5.0,
    "tresize": 5.0,
    "ts_paint": 2.0,
    "tscrollx": 2.0,
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
    "v8_7": "V8.2C_version_7"
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

treeherder.value("thBugzillaProductObject", {
    "accessible":
        ["Core :: Disability Access APIs","Firefox :: Disability Access"],
    "addon-sdk":
        ["Add-on SDK :: General"],
    "b2g":
        ["Firefox OS :: General"],
    "browser":
        ["Firefox :: General"],
    "build":
        ["Core :: Build Config"],
    "caps":
        ["Core :: Security: CAPS"],
    "config":
        ["Firefox :: Build Config","Core :: Build Config","Firefox for Android :: Build Config & IDE Support"],
    "db":
        ["Toolkit :: Storage"],
    "devtools":
        ["Firefox :: Developer Tools"],
    "docshell":
        ["Core :: Document Navigation"],
    "dom":
        ["Core :: DOM"],
    "editor":
        ["Core :: Editor"],
    "embedding":
        ["Core :: Embedding: APIs"],
    "gfx":
        ["Core :: Graphics","Core :: Graphics: Layers","Core :: Graphics: Text"],
    "gradle":
        ["Core :: Build Config"],
    "hal":
        ["Core :: Hardware Abstraction Layer (HAL)"],
    "image":
        ["Core :: ImageLib"],
    "intl":
        ["Core :: Internationalization"],
    "ipc":
        ["Core :: IPC","Core :: DOM: Content Processes"],
    "js":
        ["Core :: Javascript Engine","Core :: Javascript Engine: Jit","Core :: Javascript Engine: GC","Core :: Javascript Engine: Internationalization API","Core :: Javascript Engine: Standard Library"],
    "layout":
        ["Core :: Layout"],
    "media":
        ["Core :: Audio/Video"],
    "memory":
        ["Core :: Memory Allocator"],
    "mfbt":
        ["Core :: MFBT"],
    "mobile":
        ["Firefox for Android :: General"],
    "mozglue":
        ["Core :: mozglue"],
    "netwerk":
        ["Core :: Networking"],
    "nsprpub":
        ["NSPR :: NSPR"],
    "parser":
        ["Core :: HTML: Parser"],
    "rdf":
        ["Core :: RDF"],
    "security":
        ["Core :: Security","Firefox :: Security"],
    "services":
        ["Core :: Web Services"],
    "startupcache":
        ["Core :: XPCOM"],
    "storage":
        ["Toolkit :: Storage"],
    "testing":
        ["Testing :: General"],
    "toolkit":
        ["Toolkit :: General"],
    "view":
        ["Core :: Layout"],
    "webapprt":
        ["Firefox :: Webapp Runtime"],
    "widget":
        ["Core :: Widget"],
    "xpcom":
        ["Core :: XPCOM"],
    "xpfe":
        ["Core :: XUL"],
    "xulrunner":
        ["Toolkit :: XULRunner"]
});

treeherder.value("strReloadTreeherder",
    "Reload Treeherder windows to see changes reflected."
);

treeherder.value("phDashboardValues",
    {
        e10s: {
            baseTitle: "non-e10s",
            defaultRepo: "mozilla-inbound",
            descP1: "Comparing results of all Talos tests over the last two days on mozilla-inbound " +
                    "(using pgo configuration on all platforms that support it). Because we're taking " +
                    "a sample over a period of time, improvements or regressions will take a while " +
                    "to be reflected in results. When in doubt, check the graphs by hovering over each " +
                    "line. Also, if there are no results for the default time range, try specifying a " +
                    "longer one.",
            descP2: "For more information on what is considered 'acceptable' in terms of a Talos regression, see ",
            framework: 1,
            header: "Perfherder e10s dashboard",
            linkDesc: "the official e10s release criteria.",
            linkUrl: "https://wiki.mozilla.org/index.php?title=Electrolysis/Release_Criteria",
            variantDataOpt: "e10s",
            variantTitle: "e10s"
        },
        hasal: {
            baseTitle: "chrome",
            defaultRepo: "mozilla-central",
            descP1: "Comparing Firefox with Chrome browser.",
            descP2: "For more information, see ",
            linkDesc: "the Hasal repo.",
            linkUrl: "https://github.com/Mozilla-TWQA/Hasal",
            framework: 9,
            header: "Perfherder hasal dashboard",
            variantDataOpt: "firefox",
            variantTitle: "firefox"
        }
    }
);
