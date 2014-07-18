/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

"use strict";

var Config = {
  jobDataLoader: BuildbotDBUser,
  pushlogDataLoader: PushlogJSONParser,
  defaultTreeName: "Mozilla-Central",
  loadInterval: 120, // seconds
  goBackPushes: 10,
  maxChangesets: 20,
  // Max length of the title prefix added to certain pages (eg Try).
  titlePrefixLimit: 70,
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
  wooBugURL: "https://tbpl.mozilla.org/php/starcomment.php", // war-on-orange database
  mcMergeURL: "mcmerge/",
  // treeInfo gives details about the trees and repositories. There are various
  // items that can be specified:
  //
  // - primaryRepo:    [required] The primary hg repository for the tree.
  // - otherRepo:      [optional] An additional hg repository that the tree
  //                              works with.
  //
  // Note that changes to the trees below will likely need similar changes to
  // mcmerge/js/Config.js as well.
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
    "Gaia-Try": {
      primaryRepo: "integration/gaia-try",
      buildbotBranch: "gaia-try",
      isTry: true,
    },
    "Staging-Gaia-Try": {
      primaryRepo: "users/jford_mozilla.com/gaia-try",
      buildbotBranch: "staging-gaia-try",
      isTry: true,
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
    "Mozilla-Esr31": {
      primaryRepo: "releases/mozilla-esr31",
      buildbotBranch: "mozilla-esr31",
    },
    "Mozilla-Esr24": {
      primaryRepo: "releases/mozilla-esr24",
      buildbotBranch: "mozilla-esr24",
    },
    // B2G trees
    "Mozilla-B2g30-v1.4": {
      primaryRepo: "releases/mozilla-b2g30_v1_4",
      buildbotBranch: "mozilla-b2g30_v1_4",
    },
    "Mozilla-B2g28-v1.3": {
      primaryRepo: "releases/mozilla-b2g28_v1_3",
      buildbotBranch: "mozilla-b2g28_v1_3",
    },
    "Mozilla-B2g28-v1.3t": {
      primaryRepo: "releases/mozilla-b2g28_v1_3t",
      buildbotBranch: "mozilla-b2g28_v1_3t",
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
    "Thunderbird-Esr31": {
      primaryRepo: "releases/comm-esr31",
      otherRepo: "releases/mozilla-esr31",
      buildbotBranch: "comm-esr31",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    },
    "Thunderbird-Esr24": {
      primaryRepo: "releases/comm-esr24",
      otherRepo: "releases/mozilla-esr24",
      buildbotBranch: "comm-esr24",
      buildbotBranchExtra: "-thunderbird",
      sheriff: '<a href="irc://irc.mozilla.org/#maildev" target="_blank">#maildev</a>'
    }
  },
  groupedMachineTypes: {
    "Dolphin Device Image": ["Dolphin Device Image Build",
                             "Dolphin Device Image Build (Engineering)",
                             "Dolphin Device Image Nightly",
                             "Dolphin Device Image Nightly (Engineering)"],
    "Flame Device Image": ["Flame Device Image Build",
                           "Flame Device Image Build (Engineering)",
                           "Flame Device Image Nightly",
                           "Flame Device Image Nightly (Engineering)"],
    "Buri/Hamachi Device Image": ["Hamachi Device Image Build",
                                  "Hamachi Device Image Build (Engineering)",
                                  "Hamachi Device Image Nightly",
                                  "Hamachi Device Image Nightly (Engineering)"],
    "Helix Device Image": ["Helix Device Image Build",
                           "Helix Device Image Build (Engineering)",
                           "Helix Device Image Nightly",
                           "Helix Device Image Nightly (Engineering)"],
    "Inari Device Image": ["Inari Device Image Build",
                           "Inari Device Image Build (Engineering)",
                           "Inari Device Image Nightly",
                           "Inari Device Image Nightly (Engineering)"],
    "Leo Device Image": ["Leo Device Image Build",
                         "Leo Device Image Build (Engineering)",
                         "Leo Device Image Nightly",
                         "Leo Device Image Nightly (Engineering)"],
    "Nexus 4 Device Image": ["Nexus 4 Device Image Build",
                             "Nexus 4 Device Image Build (Engineering)",
                             "Nexus 4 Device Image Nightly",
                             "Nexus 4 Device Image Nightly (Engineering)"],
    "Tarako Device Image": ["Tarako Device Image Build",
                            "Tarako Device Image Build (Engineering)",
                            "Tarako Device Image Nightly",
                            "Tarako Device Image Nightly (Engineering)"],
    "Unagi Device Image": ["Unagi Device Image Build",
                           "Unagi Device Image Build (Engineering)",
                           "Unagi Device Image Nightly",
                           "Unagi Device Image Nightly (Engineering)"],
    "Wasabi Device Image": ["Wasabi Device Image Build",
                            "Wasabi Device Image Nightly"],
    "Unknown Device Image": ["Unknown B2G Device Image Build",
                             "Unknown B2G Device Image Build (Engineering)",
                             "Unknown B2G Device Image Nightly",
                             "Unknown B2G Device Image Nightly (Engineering)"],
    "L10n Repack": ["L10n Nightly"],
    "Android x86 Test Combos": ["Android x86 Test Set"],
    "Mochitest": ["Mochitest",
                  "Mochitest WebGL",
                  "Mochitest Browser Chrome",
                  "Mochitest DevTools Browser Chrome",
                  "Mochitest Metro Browser Chrome",
                  "Mochitest Other",
                  "Webapprt Content",
                  "Webapprt Chrome",
                  "Robocop"],
    "Mochitest e10s": ["Mochitest e10s",
                       "Mochitest e10s Browser Chrome",
                       "Mochitest e10s DevTools Browser Chrome",
                       "Mochitest e10s Other"],
    "Mochitest OOP": ["Mochitest OOP"],
    "Reftest": ["Crashtest",
                "Crashtest IPC",
                "JSReftest",
                "Reftest",
                "Reftest IPC",
                "Reftest OMTC",
                "Reftest Sanity",
                "Reftest Unaccelerated"],
    "Reftest e10s": ["Crashtest e10s",
                     "JSReftest e10s",
                     "Reftest e10s"],
    "Reftest Sanity OOP": ["Reftest Sanity OOP"],
    "SpiderMonkey": ["SpiderMonkey ARM Simulator Build",
                     "SpiderMonkey DTrace Build",
                     "SpiderMonkey Fail-On-Warnings Build",
                     "SpiderMonkey Exact Rooting Shell Build",
                     "SpiderMonkey GGC Shell Build",
                     "SpiderMonkey Root Analysis Build"],
    "Talos Performance": ["Talos Performance",
                          "Talos canvasmark",
                          "Talos chrome",
                          "Talos dromaeojs",
                          "Talos dromaeojs Metro",
                          "Talos g1",
                          "Talos other",
                          "Talos other Metro",
                          "Talos paint",
                          "Talos robocheck2",
                          "Talos robopan",
                          "Talos roboprovider",
                          "Talos svg",
                          "Talos svg Metro",
                          "Talos tp",
                          "Talos tp Metro",
                          "Talos tp nochrome",
                          "Talos ts",
                          "Talos tspaint",
                          "Talos xperf"]
  },
  OSNames: {
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
    "other": "Other",
  },
  buildNames: {
    // ** Dep Builds **
    "Build" : "B",
    "Non-Unified Build": "Bn",
    "Static Checking Build" : "S",
    "SpiderMonkey" : "SM",
    "SpiderMonkey ARM Simulator Build" : "arm",
    "SpiderMonkey DTrace Build" : "d",
    "SpiderMonkey Fail-On-Warnings Build" : "e",
    "SpiderMonkey Exact Rooting Shell Build" : "exr",
    "SpiderMonkey GGC Shell Build" : "ggc",
    "SpiderMonkey Root Analysis Build" : "r",
    "Static Rooting Hazard Analysis, Full Browser" : "Hf",
    "Static Rooting Hazard Analysis, JS Shell" : "Hs",
    "Static Rooting Hazard Analysis, Mobile Browser" : "Hm",
    "Static Rooting Hazard Analysis, B2G Gecko" : "Hb",
    // ** Nightly Builds **
    "Nightly" : "N",
    "DXR Index Build" : "Dxr",
    "Valgrind Build": "V",
    "XULRunner Nightly" : "Xr",
    // ** Special Builds **
    // If we start doing debug ASan tests, please kill these special build types.
    "AddressSanitizer Opt Build": "Bo",
    "AddressSanitizer Debug Build": "Bd",
    "AddressSanitizer Opt Nightly": "No",
    "AddressSanitizer Debug Nightly": "Nd",
    // L10n nightlies are grouped above so they appear as N1, N2, etc.
    "L10n Nightly" : "N",
    "L10n Repack": "L10n",
    "B2G Emulator Image Build": "B",
    "B2G Emulator Image Non-Unified Build": "Bn",
    "B2G Emulator Image Nightly": "N",
    // B2G device image builds (grouped by device in the UI)
    "Dolphin Device Image": "Dolphin",
    "Dolphin Device Image Build": "B",
    "Dolphin Device Image Build (Engineering)": "Be",
    "Dolphin Device Image Nightly": "N",
    "Dolphin Device Image Nightly (Engineering)": "Ne",
    "Flame Device Image": "Flame",
    "Flame Device Image Build": "B",
    "Flame Device Image Build (Engineering)": "Be",
    "Flame Device Image Nightly": "N",
    "Flame Device Image Nightly (Engineering)": "Ne",
    "Buri/Hamachi Device Image": "Buri/Hamachi",
    "Hamachi Device Image Build": "B",
    "Hamachi Device Image Build (Engineering)": "Be",
    "Hamachi Device Image Nightly": "N",
    "Hamachi Device Image Nightly (Engineering)": "Ne",
    "Helix Device Image": "Helix",
    "Helix Device Image Build": "B",
    "Helix Device Image Build (Engineering)": "Be",
    "Helix Device Image Nightly": "N",
    "Helix Device Image Nightly (Engineering)": "Ne",
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
    "Nexus 4 Device Image Build (Engineering)": "Be",
    "Nexus 4 Device Image Nightly": "N",
    "Nexus 4 Device Image Nightly (Engineering)": "Ne",
    "Tarako Device Image": "Tarako",
    "Tarako Device Image Build": "B",
    "Tarako Device Image Build (Engineering)": "Be",
    "Tarako Device Image Nightly": "N",
    "Tarako Device Image Nightly (Engineering)": "Ne",
    "Unagi Device Image": "Unagi",
    "Unagi Device Image Build": "B",
    "Unagi Device Image Build (Engineering)": "Be",
    "Unagi Device Image Nightly": "N",
    "Unagi Device Image Nightly (Engineering)": "Ne",
    "Wasabi Device Image": "Wasabi",
    "Wasabi Device Image Build": "B",
    "Wasabi Device Image Nightly": "N",
    "Unknown Device Image": "Unknown",
    "Unknown B2G Device Image Build": "B",
    "Unknown B2G Device Image Build (Engineering)": "Be",
    "Unknown B2G Device Image Nightly": "N",
    "Unknown B2G Device Image Nightly (Engineering)": "Ne",
  },
  testNames: {
    // Mozbase is kind of a "glue" test suite between builds and all other tests,
    // so we list it first to make any bustage more obvious.
    "Mozbase Unit Tests" : "Mb",
    // Mochitests and reftests come next since they're the most common tests
    // run across all platforms and therefore benefit from better vertical alignment.
    "Mochitest" : "M",
    "Mochitest Browser Chrome" : "bc",
    "Mochitest DevTools Browser Chrome" : "dt",
    "Mochitest Metro Browser Chrome" : "mc",
    "Mochitest Other" : "oth",
    "Mochitest WebGL" : "gl",
    "Mochitest e10s" : "M-e10s",
    "Mochitest e10s Browser Chrome" : "bc",
    "Mochitest e10s DevTools Browser Chrome" : "dt",
    "Mochitest e10s Other" : "oth",
    "Mochitest OOP": "M-oop",
    "Robocop" : "rc",
    "Webapprt Content": "w",
    "Webapprt Chrome": "wc",
    "Crashtest" : "C",
    "Crashtest e10s" : "C",
    "Crashtest IPC" : "Cipc",
    "JSReftest" : "J",
    "JSReftest e10s" : "J",
    "Reftest" : "R",
    "Reftest e10s" : "R-e10s",
    "Reftest Sanity OOP" : "Rs-oop",
    "Reftest IPC" : "Ripc",
    "Reftest OMTC" : "Ro",
    "Reftest Sanity" : "Rs",
    "Reftest Unaccelerated" : "Ru",
    // All other unit tests, sorted alphabetically by TBPL symbol.
    "CPP Unit Tests" : "Cpp",
    "JIT Tests" : "Jit",
    "Jetpack SDK Test" : "JP",
    "Gaia Build Test" : "Gb",
    "Gaia JS Integration Test OOP" : "Gij-oop",
    "Gaia JS Integration Test" : "Gij",
    "Gaia Python Integration Test OOP" : "Gip-oop",
    "Gaia Python Integration Test" : "Gip",
    "Gaia Unit Test OOP" : "Gu-oop",
    "Gaia Unit Test" : "Gu",
    "Linter Test" : "Li",
    "Marionette Framework Unit Tests" : "Mn",
    "Marionette WebAPI Tests" : "Mnw",
    "Android x86 Test Set" : "S",
    "Android x86 Test Combos" : "Sets",
    "W3C Web Platform Tests" : "W",
    "W3C Web Platform Reftests" : "Wr",
    "XPCShell" : "X",
    "Mozmill" : "Z",
    // Display talos perf tests after correctness tests.
    "Talos Performance" : "T",
    "Talos canvasmark" : "cm",
    "Talos chrome" : "c",
    "Talos dromaeojs" : "d",
    "Talos dromaeojs Metro" : "d-m",
    "Talos g1" : "g1",
    "Talos other" : "o",
    "Talos other Metro" : "o-m",
    "Talos paint" : "p",
    "Talos robocheck2" : "rck2",
    "Talos robopan" : "rp",
    "Talos roboprovider" : "rpr",
    "Talos svg" : "s",
    "Talos svg Metro" : "s-m",
    "Talos tp" : "tp",
    "Talos tp Metro" : "tp-m",
    "Talos tp nochrome" : "tpn",
    "Talos ts" : "ts",
    "Talos tspaint" : "tsp",
    "Talos xperf" : "x",
    // Sort unknown jobs after all others.
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
