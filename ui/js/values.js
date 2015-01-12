/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.value("thPlatformNameMap", {
    "linux32": "Linux",
    "linux64": "Linux x64",
    "osx-10-6": "OS X 10.6",
    "osx-10-8": "OS X 10.8",
    "osx-10-10": "OS X 10.10",
    "windowsxp": "Windows XP",
    "windows7-32": "Windows 7",
    "windows8-32": "Windows 8",
    "windows8-64": "Windows 8 x64",
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
    "b2g-device-image" : "B2G Device Image",
    "mulet-linux32" : "Mulet Linux",
    "mulet-linux64" : "Mulet Linux x64",
    "mulet-osx": "Mulet OS X",
    "mulet-win32": "Mulet Windows",
    "other": "Other"
});

treeherder.value("thPlatformOrder", {
    "linux32": 0,
    "linux64": 1,
    "osx-10-6": 2,
    "osx-10-8": 3,
    "osx-10-9": 4,
    "windowsxp": 5,
    "windows7-32": 6,
    "windows8-32": 7,
    "windows8-64": 8,
    "windows2012-64": 9,
    "android-2-2-armv6": 10,
    "android-2-2": 11,
    "android-2-3-armv6": 12,
    "android-2-3": 13,
    "android-2-3-armv7-api9": 14,
    "android-4-0": 15,
    "android-4-0-armv7-api10": 16,
    "android-4-0-armv7-api11": 17,
    "android-4-2-x86": 18,
    "b2g-linux32": 19,
    "b2g-linux64": 20,
    "b2g-osx": 21,
    "b2g-win32": 22,
    "b2g-emu-ics": 23,
    "b2g-emu-jb": 24,
    "b2g-emu-kk": 25,
    "b2g-device-image" : 26,
    "mulet-linux32" : 27,
    "mulet-linux64" : 28,
    "mulet-osx": 29,
    "mulet-win32": 30,
    "other": 31
});

treeherder.value("thOptionOrder", {
    "opt": 0,
    "pgo": 1,
    "asan": 2,
    "debug": 3,
    "cc": 4,
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

treeherder.value("thDefaultRepo", "mozilla-central");
