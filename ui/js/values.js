/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.value("thPlatformNameMap", {
    "linux32": "Linux",
    "linux64": "Linux x64",
    "osx-10-6": "OS X 10.6",
    "osx-10-7": "OS X 10.7",
    "osx-10-8": "OS X 10.8",
    "osx-10-9": "OS X 10.9",
    "osx-10-10": "OS X 10.10",
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
    "android-4-2-x86": "Android 4.2 x86",
    "android-4-2": "Android 4.2",
    "android-4-2-armv7-api11": "Android 4.2 API11+",
    "android-4-3": "Android 4.3",
    "android-4-3-armv7-api11": "Android 4.3 API11+",
    "android-4-4": "Android 4.4",
    "android-4-4-armv7-api11": "Android 4.4 API11+",
    "android-5-0-armv7-api11": "Android 5.0 API11+",
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
    "android-4-2-x86": 38,
    "android-4-2": 39,
    "android-4-2-armv7-api11": 40,
    "android-4-3": 41,
    "android-4-3-armv7-api11": 42,
    "android-4-4": 43,
    "android-4-4-armv7-api11": 44,
    "android-5-0-armv7-api11": 45,
    "b2g-linux32": 50,
    "b2g-linux64": 51,
    "b2g-osx": 52,
    "b2g-win32": 53,
    "b2g-emu-ics": 54,
    "b2g-emu-jb": 55,
    "b2g-emu-kk": 56,
    "b2g-emu-x86-kk": 57,
    "b2g-emu-l": 58,
    "b2g-device-image" : 59,
    "mulet-linux32" : 60,
    "mulet-linux64" : 61,
    "mulet-osx": 62,
    "mulet-win32": 63,
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
      { "value":604800, "text": "Last 7 days" },
      { "value":1209600, "text": "Last 14 days" },
      { "value":2592000, "text": "Last 30 days" },
      { "value":5184000, "text": "Last 60 days" },
      { "value":7776000, "text": "Last 90 days" },
      { "value":31536000, "text": "Last year" } ]);

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
