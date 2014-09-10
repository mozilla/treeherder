'use strict';

treeherder.value("thPlatformNameMap", {
    "linux32": "Linux",
    "linux64": "Linux x64",
    "osx-10-6": "OS X 10.6",
    "osx-10-8": "OS X 10.8",
    "osx-10-9": "OS X 10.9",
    "windowsxp": "Windows XP",
    "windows7-32": "Windows 7",
    "windows8-32": "Windows 8",
    "windows2012-64": "Windows 2012 x64",
    "android-2-2-armv6": "Android 2.2 Armv6",
    "android-2-2": "Android 2.2",
    "android-2-3-armv6": "Android 2.3 Armv6",
    "android-2-3": "Android 2.3",
    "android-4-0": "Android 4.0",
    "android-4-2-x86": "Android 4.2 x86",
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

treeherder.value("thFailureResults", ["testfailed", "busted", "exception"]);

treeherder.value("thFavicons", {
    "closed": "img/tree_closed.png",
    "open": "img/tree_open.png",
    "approval required": "img/tree_open.png",
    "unavailable": "img/tree_open.png"
});
