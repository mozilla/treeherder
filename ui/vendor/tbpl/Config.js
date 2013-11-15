/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

"use strict";

var Config = {
  tinderboxDataLoader: BuildbotDBUser,
  pushlogDataLoader: PushlogJSONParser,
  defaultTreeName: "Mozilla-Central",
  loadInterval: 120, // seconds
  goBackPushes: 10,
  maxChangesets: 20,
  // By default the server-side components at '<location of index.html> + php/'
  // are used - unless index.html is opened from the local filesystem (in which
  // case we default to prodBaseURL, for easy client-side testing). To override
  // this, set serverBaseURL to the location of the TBPL backend, eg:
  // https://tbpl.mozilla.org/
  serverBaseURL: "",
  prodBaseURL: "https://tbpl.mozilla.org/", // used for log links in tbplbot bugzilla comments
  mercurialURL: "https://hg.mozilla.org/",
  buildjsonURL: "https://secure.pub.build.mozilla.org/builddata/buildjson/",
  buildapiURL: "https://secure.pub.build.mozilla.org/buildapi/",
  selfServeURL: "https://secure.pub.build.mozilla.org/buildapi/self-serve/",
  slaveHealthURL: "https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=",
  buildGraphsURL: "http://builddata.pub.build.mozilla.org/reports/pending/",
  treeStatusURL: "https://treestatus.mozilla.org/",
  alternateTinderboxPushlogURL: "http://build.mozillamessaging.com/tinderboxpushlog/?tree=",
  alternateTinderboxPushlogName: "Mozilla Messaging",
  wooBugURL: "https://tbpl.mozilla.org/php/starcomment.php", // war-on-orange database
  mcMergeURL: "mcmerge/",
  // treeInfo gives details about the trees and repositories. There are various
  // items that can be specified:
  //
  // - primaryRepo:    [required] The primary hg repository for the tree.
  // - otherRepo:      [optional] An additional hg repository that the tree
  //                              works with.
  treeInfo: {
    "Mozilla-Central": {
      primaryRepo: "mozilla-central",
      buildbotBranch: "mozilla-central",
    },
    "Mozilla-Inbound": {
      primaryRepo: "integration/mozilla-inbound",
      buildbotBranch: "mozilla-inbound",
      sheriff: '<a href="https://wiki.mozilla.org/Tree_Rules/Inbound#Meet_the_Sheriffs" target="_blank">Inbound sheriffs</a>',
    },
    "B2g-Inbound": {
      primaryRepo: "integration/b2g-inbound",
      buildbotBranch: "b2g-inbound",
      sheriff: '<a href="https://wiki.mozilla.org/Tree_Rules/Inbound#Meet_the_Sheriffs" target="_blank">Inbound sheriffs</a>',
    },
    "Try": {
      primaryRepo: "try",
      buildbotBranch: "try",
      isTry: true,
      ftpDir: "https://ftp.mozilla.org/pub/mozilla.org/firefox/try-builds"
    },
    "Mozilla-Aurora": {
      primaryRepo: "releases/mozilla-aurora",
      buildbotBranch: "mozilla-aurora",
    },
    "Mozilla-Beta": {
      primaryRepo: "releases/mozilla-beta",
      buildbotBranch: "mozilla-beta",
    },
    "Mozilla-Release": {
      primaryRepo: "releases/mozilla-release",
      buildbotBranch: "mozilla-release",
    },
    "Mozilla-Esr17": {
      primaryRepo: "releases/mozilla-esr17",
      buildbotBranch: "mozilla-esr17",
    },
    "Mozilla-Esr24": {
      primaryRepo: "releases/mozilla-esr24",
      buildbotBranch: "mozilla-esr24",
    },
    // B2G trees
    "Mozilla-B2g18": {
      primaryRepo: "releases/mozilla-b2g18",
      buildbotBranch: "mozilla-b2g18",
    },
    "Mozilla-B2g18-v1.1.0hd": {
      primaryRepo: "releases/mozilla-b2g18_v1_1_0_hd",
      buildbotBranch: "mozilla-b2g18_v1_1_0_hd",
    },
    "Mozilla-B2g26-v1.2": {
      primaryRepo: "releases/mozilla-b2g26_v1_2",
      buildbotBranch: "mozilla-b2g26_v1_2",
    },
    // Project/team trees
    "Jetpack": {
      primaryRepo: "projects/addon-sdk",
      buildbotBranch: "addon-sdk",
      prettierName: "Addon-SDK",
      sheriff: '<a href="irc://irc.mozilla.org/#jetpack" target="_blank">#jetpack</a>'
    },
    "Build-System": {
      primaryRepo: "projects/build-system",
      buildbotBranch: "build-system",
      sheriff: '<a href="irc://irc.mozilla.org/#pymake" target="_blank">#pymake</a>'
    },
    "Fx-Team": {
      primaryRepo: "integration/fx-team",
      buildbotBranch: "fx-team",
      sheriff: '<a href="irc://irc.mozilla.org/#fx-team" target="_blank">#fx-team</a>'
    },
    "Graphics": {
      primaryRepo: "projects/graphics",
      buildbotBranch: "graphics",
      sheriff: '<a href="irc://irc.mozilla.org/#gfx" target="_blank">#gfx</a>'
    },
    "Ionmonkey": {
      primaryRepo: "projects/ionmonkey",
      buildbotBranch: "ionmonkey",
      sheriff: '<a href="irc://irc.mozilla.org/#jsapi" target="_blank">#jsapi</a>'
    },
    "Profiling": {
      primaryRepo: "projects/profiling",
      buildbotBranch: "profiling",
    },
    "Services-Central": {
      primaryRepo: "services/services-central",
      buildbotBranch: "services-central",
      sheriff: '<a href="irc://irc.mozilla.org/#sync" target="_blank">#sync</a>'
    },
    "UX": {
      primaryRepo: "projects/ux",
      buildbotBranch: "ux",
      sheriff: '<a href="irc://irc.mozilla.org/#ux" target="_blank">#ux</a>'
    },
    // Rental twigs
    "Alder": {
      primaryRepo: "projects/alder",
      buildbotBranch: "alder",
    },
    "Ash": {
      primaryRepo: "projects/ash",
      buildbotBranch: "ash",
    },
    "Birch": {
      primaryRepo: "projects/birch",
      buildbotBranch: "birch",
    },
    "Cedar": {
      primaryRepo: "projects/cedar",
      buildbotBranch: "cedar",
    },
    "Cypress": {
      primaryRepo: "projects/cypress",
      buildbotBranch: "cypress",
    },
    "Date": {
      primaryRepo: "projects/date",
      buildbotBranch: "date",
    },
    "Elm": {
      primaryRepo: "projects/elm",
      buildbotBranch: "elm",
    },
    "Fig": {
      primaryRepo: "projects/fig",
      buildbotBranch: "fig",
    },
    "Gum": {
      primaryRepo: "projects/gum",
      buildbotBranch: "gum",
    },
    "Holly": {
      primaryRepo: "projects/holly",
      buildbotBranch: "holly",
    },
    "Jamun": {
      primaryRepo: "projects/jamun",
      buildbotBranch: "jamun",
    },
    "Larch": {
      primaryRepo: "projects/larch",
      buildbotBranch: "larch",
    },
    "Maple": {
      primaryRepo: "projects/maple",
      buildbotBranch: "maple",
    },
    "Oak": {
      primaryRepo: "projects/oak",
      buildbotBranch: "oak",
    },
    "Pine": {
      primaryRepo: "projects/pine",
      buildbotBranch: "pine",
    },
    // Thunderbird trees
    "Thunderbird-Trunk": {
      primaryRepo: "comm-central",
      otherRepo: "mozilla-central",
      buildbotBranch: "comm-central",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    },
    "Thunderbird-Try": {
      primaryRepo: "try-comm-central",
      otherRepo: "mozilla-central",
      buildbotBranch: "try-comm-central",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>',
      isTry: true,
      ftpDir: "https://ftp.mozilla.org/pub/mozilla.org/thunderbird/try-builds"
    },
    "Thunderbird-Aurora": {
      primaryRepo: "releases/comm-aurora",
      otherRepo: "releases/mozilla-aurora",
      buildbotBranch: "comm-aurora",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    },
    "Thunderbird-Beta": {
      primaryRepo: "releases/comm-beta",
      otherRepo: "releases/mozilla-beta",
      buildbotBranch: "comm-beta",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    },
    "Thunderbird-Esr24": {
      primaryRepo: "releases/comm-esr24",
      otherRepo: "releases/mozilla-esr24",
      buildbotBranch: "comm-esr24",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    },
    "Thunderbird-Esr17": {
      primaryRepo: "releases/comm-esr17",
      otherRepo: "releases/mozilla-esr17",
      buildbotBranch: "comm-esr17",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    }
  },
  groupedMachineTypes: {
    "Hamachi Device Image": ["Hamachi Device Image Build",
                             "Hamachi Device Image Build (Engineering)",
                             "Hamachi Device Image Nightly",
                             "Hamachi Device Image Nightly (Engineering)"],
    "Helix Device Image": ["Helix Device Image Build",
                           "Helix Device Image Nightly"],
    "Inari Device Image": ["Inari Device Image Build",
                           "Inari Device Image Build (Engineering)",
                           "Inari Device Image Nightly",
                           "Inari Device Image Nightly (Engineering)"],
    "Leo Device Image": ["Leo Device Image Build",
                         "Leo Device Image Build (Engineering)",
                         "Leo Device Image Nightly",
                         "Leo Device Image Nightly (Engineering)"],
    "Nexus 4 Device Image": ["Nexus 4 Device Image Build",
                             "Nexus 4 Device Image Nightly"],
    "Unagi Device Image": ["Unagi Device Image Build",
                           "Unagi Device Image Build (Engineering)",
                           "Unagi Device Image Nightly",
                           "Unagi Device Image Nightly (Engineering)"],
    "Unknown Device Image": ["Unknown B2G Device Image Build",
                             "Unknown B2G Device Image Build (Engineering)",
                             "Unknown B2G Device Image Nightly",
                             "Unknown B2G Device Image Nightly (Engineering)"],
    "L10n Repack": ["L10n Nightly"],
    "Android x86 Test Combos": ["Android x86 Test Set"],
    "Mochitest": ["Mochitest",
                  "Mochitest WebGL",
                  "Mochitest Browser Chrome",
                  "Mochitest Metro Browser Chrome",
                  "Mochitest Other",
                  "Robocop"],
    "Reftest": ["Crashtest",
                "Crashtest-IPC",
                "Reftest",
                "Reftest Unaccelerated",
                "Reftest-IPC",
                "JSReftest"],
    "SpiderMonkey": ["SpiderMonkey DTrace Build",
                     "SpiderMonkey --enable-root-analysis Build",
                     "SpiderMonkey --enable-sm-fail-on-warnings Build",
                     "SpiderMonkey GGC Shell Build",
                     "SpiderMonkey Exact Rooting Shell Build",
                     "Static Rooting Hazard Analysis, JS Shell",
                     "Static Rooting Hazard Analysis, Full Browser"],
    "Talos Performance": ["Talos Performance",
                          "Talos canvasmark",
                          "Talos chrome",
                          "Talos dromaeojs",
                          "Talos other",
                          "Talos paint",
                          "Talos robocheck2",
                          "Talos robopan",
                          "Talos roboprovider",
                          "Talos svg",
                          "Talos tp",
                          "Talos tp nochrome",
                          "Talos ts",
                          "Talos tspaint",
                          "Talos xperf"]
  },
  OSNames: {
    "linux32": "Linux",
    "linux64": "Linux x64",
    "osx-10-6": "OS X 10.6",
    "osx-10-7": "OS X 10.7",
    "osx-10-8": "OS X 10.8",
    "windowsxp": "Windows XP",
    "windows7-32": "Windows 7",
    "windows8-32": "Windows 8",
    "windows2012-64": "Windows 2012 x64",
    "android-2-2-armv6": "Android 2.2 Armv6",
    "android-2-2": "Android 2.2",
    "android-2-2-noion": "Android 2.2 NoIon",
    "android-4-0": "Android 4.0",
    "android-4-2-x86": "Android 4.2 x86",
    "b2g-linux32": "B2G Desktop Linux",
    "b2g-linux64": "B2G Desktop Linux x64",
    "b2g-osx": "B2G Desktop OS X",
    "b2g-win32": "B2G Desktop Windows",
    "b2g-emu-ics": "B2G ICS Emulator",
    "b2g-emu-jb": "B2G JB Emulator",
    "b2g-device-image" : "B2G Device Image",
    "other": "Other",
  },
  buildNames: {
    // ** Dep Builds **
    "Build" : "B",
    "Static Checking Build" : "S",
    "SpiderMonkey" : "SM",
    "SpiderMonkey DTrace Build" : "d",
    "SpiderMonkey --enable-root-analysis Build" : "r",
    "SpiderMonkey --enable-sm-fail-on-warnings Build" : "e",
    "SpiderMonkey GGC Shell Build" : "ggc",
    "SpiderMonkey Exact Rooting Shell Build" : "exr",
    "Static Rooting Hazard Analysis, JS Shell" : "Hs",
    "Static Rooting Hazard Analysis, Full Browser" : "Hf",
    // ** Nightly Builds **
    "Nightly" : "N",
    "DXR Index Build" : "Dxr",
    "Valgrind Nightly": "V",
    "XULRunner Nightly" : "Xr",
    // ** Special Builds **
    // If we start doing debug ASan tests, please
    // kill these special build types
    "AddressSanitizer Opt Build": "Bo",
    "AddressSanitizer Debug Build": "Bd",
    "AddressSanitizer Opt Nightly": "No",
    "AddressSanitizer Debug Nightly": "Nd",
    // L10n nightlies are grouped above so they appear as N1, N2, etc.
    "L10n Nightly" : "N",
    "L10n Repack": "L10n",
    "B2G Emulator Image Build": "B",
    // B2G device image builds (grouped by device in the UI)
    "Hamachi Device Image": "Hamachi",
    "Hamachi Device Image Build": "B",
    "Hamachi Device Image Build (Engineering)": "Be",
    "Hamachi Device Image Nightly": "N",
    "Hamachi Device Image Nightly (Engineering)": "Ne",
    "Helix Device Image": "Helix",
    "Helix Device Image Build": "B",
    "Helix Device Image Nightly": "N",
    "Inari Device Image": "Inari",
    "Inari Device Image Build": "B",
    "Inari Device Image Build (Engineering)": "Be",
    "Inari Device Image Nightly": "N",
    "Inari Device Image Nightly (Engineering)": "Ne",
    "Leo Device Image": "Leo",
    "Leo Device Image Build": "B",
    "Leo Device Image Build (Engineering)": "Be",
    "Leo Device Image Nightly": "N",
    "Leo Device Image Nightly (Engineering)": "Ne",
    "Nexus 4 Device Image": "Nexus 4",
    "Nexus 4 Device Image Build": "B",
    "Nexus 4 Device Image Nightly": "N",
    "Unagi Device Image": "Unagi",
    "Unagi Device Image Build": "B",
    "Unagi Device Image Build (Engineering)": "Be",
    "Unagi Device Image Nightly": "N",
    "Unagi Device Image Nightly (Engineering)": "Ne",
    "Unknown Device Image": "Unknown",
    "Unknown B2G Device Image Build": "B",
    "Unknown B2G Device Image Build (Engineering)": "Be",
    "Unknown B2G Device Image Nightly": "N",
    "Unknown B2G Device Image Nightly (Engineering)": "Ne",
  },
  testNames: {
    "Mochitest" : "M",
    "Mochitest WebGL" : "gl",
    "Mochitest Browser Chrome" : "bc",
    "Mochitest Metro Browser Chrome" : "mc",
    "Mochitest Other" : "oth",
    "Robocop" : "rc",
    "Crashtest-IPC" : "Cipc",
    "Crashtest" : "C",
    "Reftest Unaccelerated" : "Ru",
    "Reftest-IPC" : "Ripc",
    "Reftest" : "R",
    "JSReftest" : "J",
    "CPP Unit Tests" : "Cpp",
    "JIT Tests" : "Jit",
    "Marionette WebAPI Tests" : "Mnw",
    "Marionette Framework Unit Tests" : "Mn",
    "Gaia Integration Test" : "Gi",
    "Gaia UI Test" : "Gu",
    "Gaia Unit Test" : "G",
    "XPCShellTest" : "X",
    "Android x86 Test Combos" : "Sets", 
    "Android x86 Test Set" : "S",
    "Talos Performance" : "T",
    "Talos canvasmark" : "cm",
    "Talos chrome" : "c",
    "Talos dromaeojs" : "d",
    "Talos svg" : "s",
    "Talos tp" : "tp",
    "Talos tp nochrome" : "tpn",
    "Talos other" : "o",
    "Talos paint" : "p",
    "Talos robocheck2" : "rck2",
    "Talos robopan" : "rp",
    "Talos roboprovider" : "rpr",
    "Talos ts" : "ts",
    "Talos tspaint" : "tsp",
    "Talos xperf" : "x",
    "Jetpack SDK Test" : "JP",
    "Mozmill" : "Z",
    "Unknown Unit Test" : "U",
    "Unknown": "?",
  },
};

// Fix up paths when running from the local filesystem
if (window.location.protocol == "file:") {
  // Default to the production TBPL backend unless we've overidden
  // at the top of this file.
  if (!Config.serverBaseURL)
    Config.serverBaseURL = Config.prodBaseURL;
  // Fix up mcMerge links
  Config.mcMergeURL += 'index.html';
}

Config.clientAbsoluteURL = document.location.href.replace(/\/[^\/]+$/, '/');
Config.serverAbsoluteURL = Config.serverBaseURL || Config.clientAbsoluteURL;

Config.resultNames = {};
(function() {
  for (var b in Config.buildNames) {
    Config.resultNames[b] = Config.buildNames[b];
  }
  for (var t in Config.testNames) {
    Config.resultNames[t] = Config.testNames[t];
  }
})();

// prepopulate some key arrays, so we don’t have to call Objects.keys()
Config.OSNameKeys = Object.keys(Config.OSNames);
Config.resultNameKeys = Object.keys(Config.resultNames);
Config.groups = Object.keys(Config.groupedMachineTypes);
