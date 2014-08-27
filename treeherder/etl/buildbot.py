import re

RESULT_DICT = {
    0: "success",
    1: "testfailed",
    2: "busted",
    3: "skipped",
    4: "exception",
    5: "retry",
    6: "usercancel"
}

####
#   The following variables were taken from util.py
#
#   PLATFORMS_BUILDERNAME, BUILD_TYPE_BUILDERNAME, JOB_TYPE_BUILDERNAME
#
#   http://mxr.mozilla.org/build/source/buildapi/buildapi/model/util.py
#
#   PIPEDREAM: Once these attributes are available as build properties in the
#         pulse stream these structures can be removed.
####

# source for these is in ``Data.js.getMachine`` function.
PLATFORMS_BUILDERNAME = [

    #// ** Linux **

    {
        'regex': re.compile('^b2g.*_(?:linux|ubuntu)64', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('^(?:Linux|Ubuntu).*64 Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'mulet-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('(?:linux|ubuntu).*64|dxr', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('^b2g.*_(?:linux|ubuntu)32', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('^(?:Linux|Ubuntu).*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'mulet-linux32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('linux|ubuntu', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux32',
            'arch': 'x86',
        }
    },

    #// ** OS X **

    {
        'regex': re.compile('^b2g.*_macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'b2g-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('^OS X.*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'mulet-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('Mavericks', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-9',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('OS X 10\.7|lion', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-8',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('snow[ ]?leopard', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-6',
            'arch': 'x86_64',
        }
    },

    #// ** Windows **

    {
        'regex': re.compile('^b2g.*_win32', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'b2g-win32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('^Windows.*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'mulet-win32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('WINNT 5|-xp-|Windows XP 32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windowsxp',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('WINNT 6\.1 x(?:86-)?64|win64', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows2012-64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('WINNT 6\.1|win7|Windows 7 32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('WINNT 6\.2|win8', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-32',
            'arch': 'x86',
        }
    },

    #// ** Android **

    {
        'regex': re.compile('android 4\.2 x86', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-2-x86',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('android 4\.0', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile('android 2\.3 armv6', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-3-armv6',
            'arch': 'armv6',
        }
    },
    {
        'regex': re.compile('android 2\.3', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-3',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile('android 2\.2 armv6', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2-armv6',
            'arch': 'armv6',
        }
    },
    {
        'regex': re.compile('android 2\.2', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2',
            'arch': 'armv7',
        }
    },

    #// ** B2G **

    {
        'regex': re.compile('b2g.*_emulator-kk', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-kk',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile('b2g.*_emulator-jb', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-jb',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile('b2g.*_emulator(?:-ics)?', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-ics',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile('b2g.*_(?:dep|nightly|periodic)$', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-device-image',
            'arch': 'armv7',
        }
    }
]

VM_STATUS = [
    re.compile(' VM '),
    re.compile('.*_vm ')
]

BUILD_TYPE_BUILDERNAME = [
    {
        'type': 'pgo',
        'regex': re.compile('.+ pgo(?:[ ]|-).+'),
    },
    {
        'type': 'asan',
        'regex': re.compile('.+ asan .+'),
    },
    {
        'type': 'debug',
        'regex': re.compile('(?:debug|leak)', re.IGNORECASE),
    }
    # defaults to "opt" if not found
]

JOB_TYPE_BUILDERNAME = {
    'build': [
        re.compile('.+build'),
        re.compile('.+_dep'),
        re.compile('.+(?<!l10n)[ _]nightly$'),
        re.compile('.+ xulrunner$'),
        re.compile('.+ code coverage$'),
        re.compile('.*valgrind$'),
        re.compile('.*non-unified'),
    ],
    'unittest': [
        re.compile('jetpack.*(opt|debug)$'),
        re.compile('.+(?<!leak) test .+'),
    ],
    'talos': [re.compile('.+ talos .+')],
    'repack': [re.compile('.+ l10n .+')],
}

# from Data.js ``type`` Config.testNames and Config.buildNames
TEST_NAME_BUILDERNAME = [
        #// ** Talos **
    {"regex": re.compile('talos remote-tcanvasmark$'), "desc": "Talos canvasmark"},
    {"regex": re.compile('talos chrome[z]?$'), "desc": "Talos chrome"},
    {"regex": re.compile('talos dromaeojs-metro$'), "desc": "Talos dromaeojs Metro"},
    {"regex": re.compile('talos dromaeojs$'), "desc": "Talos dromaeojs"},
    {"regex": re.compile('talos g1$'), "desc": "Talos g1"},
    {"regex": re.compile('talos other-metro$'), "desc": "Talos other Metro"},
    {"regex": re.compile('talos other'), "desc": "Talos other"},
    {"regex": re.compile('talos dirtypaint$'), "desc": "Talos paint"},
    {"regex": re.compile('talos remote-trobocheck2$'), "desc": "Talos robocheck2"},
    {"regex": re.compile('talos remote-trobopan$'), "desc": "Talos robopan"},
    {"regex": re.compile('talos remote-troboprovider$'), "desc": "Talos roboprovider"},
    {"regex": re.compile('talos (?:remote-t)?svg[rx]?-metro$'), "desc": "Talos svg Metro"},
    {"regex": re.compile('talos (?:remote-t)?svg[rx]?$'), "desc": "Talos svg"},
    {"regex": re.compile('talos (?:remote-)?tp5o-metro$'), "desc": "Talos tp Metro"},
    {"regex": re.compile('talos remote-tp4m_nochrome$'), "desc": "Talos tp nochrome"},
    {"regex": re.compile('talos (?:remote-)?tp'), "desc": "Talos tp"},
    {"regex": re.compile('talos remote-tspaint$'), "desc": "Talos tspaint"},
    {"regex": re.compile('talos remote-ts$'), "desc": "Talos ts"},
    {"regex": re.compile('talos xperf$'), "desc": "Talos xperf"},
        #// ** Unit tests **
        #// These are generally sorted in the same order as how they are sorted in
        #// Config.js, though some exceptions are needed to avoid false-positives.
    {"regex": re.compile('mozbase'), "desc": "Mozbase Unit Tests"},
    {"regex": re.compile('mochitest-e10s-browser-chrome'), "desc": "Mochitest e10s Browser Chrome (multiprocess - integration tests with a standard browser)"},
    {"regex": re.compile('mochitest-e10s-devtools-chrome'), "desc": "Mochitest e10s DevTools Browser Chrome (multiprocess - integration test with a standard browser with the devtools frame)"},
    {"regex": re.compile('mochitest-e10s-other'), "desc": "Mochitest e10s Other (multiprocess - integration test)"},
    {"regex": re.compile('mochitest-e10s'), "desc": "Mochitest e10s (multiprocess - integration tests)"},
    {"regex": re.compile('mochitest-browser-chrome'), "desc": "Mochitest Browser Chrome (integration test with a standard browser)"},
    {"regex": re.compile('mochitest-devtools-chrome'), "desc": "Mochitest DevTools Browser Chrome (integration test with some XUL)"},
    {"regex": re.compile('mochitest-metro-chrome'), "desc": "Mochitest Metro Browser Chrome"},
    {"regex": re.compile('mochitest-other'), "desc": "Mochitest Other (integration test)"},
    {"regex": re.compile('mochitest-gl'), "desc": "Mochitest WebGL (integration test using WebGL)"},
    {"regex": re.compile('mochitest-oop'), "desc": "Mochitest OOP (integration test, b2g out-of-process)"},
    {"regex": re.compile('mochitest'), "desc": "Mochitest (integration test)"},
    {"regex": re.compile('webapprt-chrome'), "desc": "Webapprt Chrome (Web App Runtime with the browser chrome)"},
    {"regex": re.compile('webapprt-content'), "desc": "Webapprt Content (Content rendering of the Web App Runtime)"},
    {"regex": re.compile('web-platform-tests$'), "desc": "W3C Web Platform Tests"},
    {"regex": re.compile('web-platform-tests-reftests'), "desc": "W3C Web Platform Reftests"},
    {"regex": re.compile('robocop'), "desc": "Robocop (UI-level testing on Android)"},
    {"regex": re.compile('crashtest-e10s'), "desc": "Crashtest e10s (Check if crashes on a page)"},
    {"regex": re.compile('crashtest-ipc'), "desc": "Crashtest IPC (layout and graphics correctness, separate process)"},
    {"regex": re.compile('crashtest'), "desc": "Crashtest (Check if crashes on a page)"},
    {"regex": re.compile('jsreftest-e10s'), "desc": "JSReftest e10s (multiprocess - JavaScript correctness)"},
    {"regex": re.compile('jsreftest'), "desc": "JSReftest (JavaScript correctness)"},
    {"regex": re.compile('reftest-e10s'), "desc": "Reftest e10s (layout and graphics correctness)"},
    {"regex": re.compile('reftest-sanity-oop'), "desc": "Reftest Sanity OOP (layout and graphics correctness, b2g out-of-process)"},
    {"regex": re.compile('reftest-ipc'), "desc": "Reftest IPC (layout and graphics correctness, separate process)"},
    {"regex": re.compile('reftest-omtc'), "desc": "Reftest OMTC (layout and graphics correctness, Off Main Thread Compositing)"},
    {"regex": re.compile('reftest-no-accel'), "desc": "Reftest Unaccelerated (layout and graphics correctness)"},
    {"regex": re.compile('reftest'), "desc": "Reftest (layout and graphics correctness)"},
    {"regex": re.compile('cppunit'), "desc": "CPP Unit Tests (C++ tests)"},
    {"regex": re.compile('jittest'), "desc": "JIT Tests (Just-In-time feature)"},
    {"regex": re.compile('jetpack'), "desc": "Jetpack SDK Test (Add-on SDK)"},
    {"regex": re.compile('gaia-unit-oop'), "desc": "Gaia Unit Test OOP"},
    {"regex": re.compile('gaia-unit'), "desc": "Gaia Unit Test"},
    {"regex": re.compile('gaia-build'), "desc": "Gaia Build Test"},
    {"regex": re.compile('gaia-integration-oop'), "desc": "Gaia Integration Test OOP"},
    {"regex": re.compile('gaia-integration'), "desc": "Gaia Integration Test"},
    {"regex": re.compile('gaia-ui-test-oop'), "desc": "Gaia UI Test OOP"},
    {"regex": re.compile('gaia-ui-test'), "desc": "Gaia UI Test"},
    {"regex": re.compile('linter'), "desc": "Linter Test (Coding style compliance)"},
    {"regex": re.compile('marionette-webapi'), "desc": "Marionette WebAPI Tests (test WebAPIs using marionette)"},
    {"regex": re.compile('marionette'), "desc": "Marionette Framework Unit Tests (Check UI or the internal JavaScript using marionette)"},
    {"regex": re.compile('androidx86-set'), "desc": "Android x86 Test Set"},
    {"regex": re.compile('xpcshell'), "desc": "XPCShell (API direct unit testing)"},
    {"regex": re.compile('mozmill'), "desc": "Mozmill"},
        #// ** Builds **
        #// If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile('debug asan nightly'), "desc": "AddressSanitizer Debug Nightly"},
    {"regex": re.compile('asan nightly'), "desc": "AddressSanitizer Opt Nightly"},
    {"regex": re.compile('-br-haz'), "desc": "Static Rooting Hazard Analysis, Full Browser"},
    {"regex": re.compile('-sh-haz'), "desc": "Static Rooting Hazard Analysis, JS Shell"},
    {"regex": re.compile('xulrunner'), "desc": "XULRunner Nightly"},
    {"regex": re.compile('b2g.*_dolphin_eng_nightly'), "desc": "Dolphin Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_flame_eng_nightly'), "desc": "Flame Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_hamachi_eng_nightly'), "desc": "Hamachi Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_helix_eng_nightly'), "desc": "Helix Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_inari_eng_nightly'), "desc": "Inari Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_leo_eng_nightly'), "desc": "Leo Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_nexus-4_eng_nightly'), "desc": "Nexus 4 Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_tarako_eng_nightly'), "desc": "Tarako Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_unagi_eng_nightly'), "desc": "Unagi Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_eng_nightly'), "desc": "Unknown B2G Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_emulator.*_nightly'), "desc": "B2G Emulator Image Nightly"},
    {"regex": re.compile('b2g.*_dolphin_nightly'), "desc": "Dolphin Device Image Nightly"},
    {"regex": re.compile('b2g.*_flame_nightly'), "desc": "Flame Device Image Nightly"},
    {"regex": re.compile('b2g.*_hamachi_nightly'), "desc": "Hamachi Device Image Nightly"},
    {"regex": re.compile('b2g.*_helix_nightly'), "desc": "Helix Device Image Nightly"},
    {"regex": re.compile('b2g.*_inari_nightly'), "desc": "Inari Device Image Nightly"},
    {"regex": re.compile('b2g.*_leo_nightly'), "desc": "Leo Device Image Nightly"},
    {"regex": re.compile('b2g.*_nexus-4_nightly'), "desc": "Nexus 4 Device Image Nightly"},
    {"regex": re.compile('b2g.*_tarako_nightly'), "desc": "Tarako Device Image Nightly"},
    {"regex": re.compile('b2g.*_unagi_nightly'), "desc": "Unagi Device Image Nightly"},
    {"regex": re.compile('b2g.*_wasabi_nightly'), "desc": "Wasabi Device Image Nightly"},
    {"regex": re.compile('b2g.*_nightly'), "desc": "Unknown B2G Device Image Nightly"},
    {"regex": re.compile('(?:l10n|localizer) nightly'), "desc": "L10n Nightly"},
    {"regex": re.compile('nightly'), "desc": "Nightly"},
    {"regex": re.compile('b2g.*_dolphin_eng_(?:dep|periodic)'), "desc": "Dolphin Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_flame_eng_(?:dep|periodic)'), "desc": "Flame Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_hamachi_eng_(?:dep|periodic)'), "desc": "Hamachi Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_helix_eng_(?:dep|periodic)'), "desc": "Helix Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_inari_eng_(?:dep|periodic)'), "desc": "Inari Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_leo_eng_(?:dep|periodic)'), "desc": "Leo Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_nexus-4_eng_(?:dep|periodic)'), "desc": "Nexus 4 Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_tarako_eng_(?:dep|periodic)'), "desc": "Tarako Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_unagi_eng_(?:dep|periodic)'), "desc": "Unagi Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_eng_(?:dep|periodic)'), "desc": "Unknown B2G Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_emulator.*_nonunified'), "desc": "B2G Emulator Image Non-Unified Build"},
    {"regex": re.compile('b2g.*_emulator.*_(?:dep|periodic)'), "desc": "B2G Emulator Image Build"},
    {"regex": re.compile('b2g.*_dolphin_(?:dep|periodic)'), "desc": "Dolphin Device Image Build"},
    {"regex": re.compile('b2g.*_flame_(?:dep|periodic)'), "desc": "Flame Device Image Build"},
    {"regex": re.compile('b2g.*_hamachi_(?:dep|periodic)'), "desc": "Hamachi Device Image Build"},
    {"regex": re.compile('b2g.*_helix_(?:dep|periodic)'), "desc": "Helix Device Image Build"},
    {"regex": re.compile('b2g.*_inari_(?:dep|periodic)'), "desc": "Inari Device Image Build"},
    {"regex": re.compile('b2g.*_leo_(?:dep|periodic)'), "desc": "Leo Device Image Build"},
    {"regex": re.compile('b2g.*_nexus-4_(?:dep|periodic)'), "desc": "Nexus 4 Device Image Build"},
    {"regex": re.compile('b2g.*_tarako_(?:dep|periodic)'), "desc": "Tarako Device Image Build"},
    {"regex": re.compile('b2g.*_unagi_(?:dep|periodic)'), "desc": "Unagi Device Image Build"},
    {"regex": re.compile('b2g.*_wasabi_(?:dep|periodic)'), "desc": "Wasabi Device Image Build"},
    {"regex": re.compile('b2g.*_(?:dep|periodic)'), "desc": "Unknown B2G Device Image Build"},
    {"regex": re.compile('spidermonkey.*-arm-sim'), "desc": "SpiderMonkey ARM Simulator Build"},
    {"regex": re.compile('spidermonkey.*-dtrace'), "desc": "SpiderMonkey DTrace Build"},
    {"regex": re.compile('spidermonkey.*-warnaserr'), "desc": "SpiderMonkey Fail-On-Warnings Build"},
    {"regex": re.compile('spidermonkey.*-exactroot'), "desc": "SpiderMonkey Exact Rooting Shell Build"},
    {"regex": re.compile('spidermonkey.*-generational'), "desc": "SpiderMonkey GGC Shell Build"},
    {"regex": re.compile('spidermonkey.*-rootanalysis'), "desc": "SpiderMonkey Root Analysis Build"},
        #// If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile('debug asan build'), "desc": "AddressSanitizer Debug Build"},
    {"regex": re.compile('asan build'), "desc": "AddressSanitizer Opt Build"},
    {"regex": re.compile('non[-]?unified'), "desc": "Non-Unified Build"},
    {"regex": re.compile('static analysis'), "desc": "Static Checking Build"},
    {"regex": re.compile('valgrind'), "desc": "Valgrind Build"},
    {"regex": re.compile('dxr'), "desc": "DXR Index Build"},
    {"regex": re.compile('(build|dep|periodic)$'), "desc": "Build"},
]

# map test names to group names as "<testname>": "<groupname>"
# when updating, please take care to ensure the ``testname`` AND the
# ``groupname`` exist in the ``SYMBOLS`` dict as well.
GROUP_NAMES = {
    "Dolphin Device Image Build": "Dolphin Device Image",
    "Dolphin Device Image Build (Engineering)": "Dolphin Device Image",
    "Dolphin Device Image Nightly": "Dolphin Device Image",
    "Dolphin Device Image Nightly (Engineering)": "Dolphin Device Image",
    "Flame Device Image Build": "Flame Device Image",
    "Flame Device Image Build (Engineering)": "Flame Device Image",
    "Flame Device Image Nightly": "Flame Device Image",
    "Flame Device Image Nightly (Engineering)": "Flame Device Image",
    "Hamachi Device Image Build": "Buri/Hamachi Device Image",
    "Hamachi Device Image Build (Engineering)": "Buri/Hamachi Device Image",
    "Hamachi Device Image Nightly": "Buri/Hamachi Device Image",
    "Hamachi Device Image Nightly (Engineering)": "Buri/Hamachi Device Image",
    "Helix Device Image Build": "Helix Device Image",
    "Helix Device Image Build (Engineering)": "Helix Device Image",
    "Helix Device Image Nightly": "Helix Device Image",
    "Helix Device Image Nightly (Engineering)": "Helix Device Image",
    "Inari Device Image Build": "Inari Device Image",
    "Inari Device Image Build (Engineering)": "Inari Device Image",
    "Inari Device Image Nightly": "Inari Device Image",
    "Inari Device Image Nightly (Engineering)": "Inari Device Image",
    "Leo Device Image Build": "Leo Device Image",
    "Leo Device Image Build (Engineering)": "Leo Device Image",
    "Leo Device Image Nightly": "Leo Device Image",
    "Leo Device Image Nightly (Engineering)": "Leo Device Image",
    "Nexus 4 Device Image Build": "Nexus 4 Device Image",
    "Nexus 4 Device Image Build (Engineering)": "Nexus 4 Device Image",
    "Nexus 4 Device Image Nightly": "Nexus 4 Device Image",
    "Nexus 4 Device Image Nightly (Engineering)": "Nexus 4 Device Image",
    "Tarako Device Image Build": "Tarako Device Image",
    "Tarako Device Image Build (Engineering)": "Tarako Device Image",
    "Tarako Device Image Nightly": "Tarako Device Image",
    "Tarako Device Image Nightly (Engineering)": "Tarako Device Image",
    "Unagi Device Image Build": "Unagi Device Image",
    "Unagi Device Image Build (Engineering)": "Unagi Device Image",
    "Unagi Device Image Nightly": "Unagi Device Image",
    "Unagi Device Image Nightly (Engineering)": "Unagi Device Image",
    "Wasabi Device Image Build": "Wasabi Device Image",
    "Wasabi Device Image Nightly": "Wasabi Device Image",
    "Unknown B2G Device Image Build": "Unknown Device Image",
    "Unknown B2G Device Image Build (Engineering)": "Unknown Device Image",
    "Unknown B2G Device Image Nightly": "Unknown Device Image",
    "Unknown B2G Device Image Nightly (Engineering)": "Unknown Device Image",
    "L10n Nightly": "L10n Repack",
    "Android x86 Test Set": "Android x86 Test Combos",
    "Mochitest": "Mochitest",
    "Mochitest WebGL": "Mochitest",
    "Mochitest Browser Chrome": "Mochitest",
    "Mochitest DevTools Browser Chrome": "Mochitest",
    "Mochitest Metro Browser Chrome": "Mochitest",
    "Mochitest Other": "Mochitest",
    "Webapprt Content": "Mochitest",
    "Webapprt Chrome": "Mochitest",
    "Robocop": "Mochitest",
    "Mochitest e10s": "Mochitest e10s",
    "Mochitest e10s Browser Chrome": "Mochitest e10s",
    "Mochitest e10s DevTools Browser Chrome": "Mochitest e10s",
    "Mochitest e10s Other": "Mochitest e10s",
    "Mochitest OOP": "Mochitest OOP",
    "Crashtest": "Reftest",
    "Crashtest IPC": "Reftest",
    "Reftest": "Reftest",
    "Reftest Unaccelerated": "Reftest",
    "Reftest IPC": "Reftest",
    "Reftest OMTC": "Reftest",
    "JSReftest": "Reftest",
    "Crashtest e10s": "Reftest e10s",
    "JSReftest e10s": "Reftest e10s",
    "Reftest e10s": "Reftest e10s",
    "Reftest Sanity OOP": "Reftest Sanity OOP",
    "SpiderMonkey ARM Simulator Build": "SpiderMonkey",
    "SpiderMonkey DTrace Build": "SpiderMonkey",
    "SpiderMonkey Fail-On-Warnings Build": "SpiderMonkey",
    "SpiderMonkey Exact Rooting Shell Build": "SpiderMonkey",
    "SpiderMonkey GGC Shell Build": "SpiderMonkey",
    "SpiderMonkey Root Analysis Build": "SpiderMonkey",
    "Static Rooting Hazard Analysis, Full Browser": "SpiderMonkey",
    "Static Rooting Hazard Analysis, JS Shell": "SpiderMonkey",
    "Talos Performance": "Talos Performance",
    "Talos canvasmark": "Talos Performance",
    "Talos chrome": "Talos Performance",
    "Talos dromaeojs": "Talos Performance",
    "Talos dromaeojs Metro": "Talos Performance",
    "Talos g1": "Talos Performance",
    "Talos other": "Talos Performance",
    "Talos other Metro": "Talos Performance",
    "Talos paint": "Talos Performance",
    "Talos robocheck2": "Talos Performance",
    "Talos robopan": "Talos Performance",
    "Talos roboprovider": "Talos Performance",
    "Talos svg": "Talos Performance",
    "Talos svg Metro": "Talos Performance",
    "Talos tp": "Talos Performance",
    "Talos tp Metro": "Talos Performance",
    "Talos tp nochrome": "Talos Performance",
    "Talos ts": "Talos Performance",
    "Talos tspaint": "Talos Performance",
    "Talos xperf": "Talos Performance"
}

# symbols displayed in the UI for all jobs and job groups
# from ``buildNames`` and ``testNames`` in ``Config.js`` file
SYMBOLS = {
    # builds

    # // ** Dep Builds **
    "Build": "B",
    "Non-Unified Build": "Bn",
    "Static Checking Build": "S",
    "SpiderMonkey": "SM",
    "SpiderMonkey ARM Simulator Build": "arm",
    "SpiderMonkey DTrace Build": "d",
    "SpiderMonkey Fail-On-Warnings Build": "e",
    "SpiderMonkey Exact Rooting Shell Build": "exr",
    "SpiderMonkey GGC Shell Build": "ggc",
    "SpiderMonkey Root Analysis Build": "r",
    "Static Rooting Hazard Analysis, Full Browser": "Hf",
    "Static Rooting Hazard Analysis, JS Shell": "Hs",
    # // ** Nightly Builds **
    "Nightly": "N",
    "DXR Index Build": "Dxr",
    "Valgrind Build": "V",
    "XULRunner Nightly": "Xr",
    # // ** Special Builds **
    # // If we start doing debug ASan tests, please
    # // kill these special build types
    "AddressSanitizer Opt Build": "Bo",
    "AddressSanitizer Debug Build": "Bd",
    "AddressSanitizer Opt Nightly": "No",
    "AddressSanitizer Debug Nightly": "Nd",
    # // L10n nightlies are grouped above so they appear as N1, N2, etc.
    "L10n Nightly": "N",
    "L10n Repack": "L10n",
    "B2G Emulator Image Build": "B",
    "B2G Emulator Image Non-Unified Build": "Bn",
    "B2G Emulator Image Nightly": "N",
    # // B2G device image builds (grouped by device in the UI)
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
    # tests

    #// Mozbase is kind of a "glue" test suite between builds and all other tests,
    #// so we list it first to make any bustage more obvious.
    "Mozbase Unit Tests": "Mb",
    #// Mochitests and reftests come next since they're the most common tests
    #// run across all platforms and therefore benefit from better vertical alignment.
    "Mochitest": "M",
    "Mochitest Browser Chrome": "bc",
    "Mochitest DevTools Browser Chrome": "dt",
    "Mochitest Metro Browser Chrome": "mc",
    "Mochitest Other": "oth",
    "Mochitest WebGL": "gl",
    "Mochitest e10s": "M-e10s",
    "Mochitest e10s Browser Chrome": "bc",
    "Mochitest e10s DevTools Browser Chrome": "dt",
    "Mochitest e10s Other": "oth",
    "Mochitest OOP": "M-oop",
    "Robocop": "rc",
    "Webapprt Content": "w",
    "Webapprt Chrome": "wc",
    "Crashtest": "C",
    "Crashtest e10s": "C",
    "Crashtest IPC": "Cipc",
    "JSReftest": "J",
    "JSReftest e10s": "J",
    "Reftest": "R",
    "Reftest e10s": "R-e10s",
    "Reftest Sanity OOP": "R-oop",
    "Reftest IPC": "Ripc",
    "Reftest OMTC": "Ro",
    "Reftest Unaccelerated": "Ru",

    #// All other unit tests, sorted alphabetically by TBPL symbol.
    "CPP Unit Tests": "Cpp",
    "JIT Tests": "Jit",
    "Jetpack SDK Test": "JP",
    "Gaia Unit Test OOP": "G-oop",
    "Gaia Unit Test": "G",
    "Gaia Build Test": "Gb",
    "Gaia Integration Test OOP": "Gi-oop",
    "Gaia Integration Test": "Gi",
    "Gaia UI Test OOP": "Gu-oop",
    "Gaia UI Test": "Gu",
    "Linter Test": "Li",
    "Marionette Framework Unit Tests": "Mn",
    "Marionette WebAPI Tests": "Mnw",
    "Android x86 Test Set": "S",
    "Android x86 Test Combos": "Sets",
    "W3C Web Platform Tests": "W",
    "W3C Web Platform Reftests": "Wr",
    "XPCShell": "X",
    "Mozmill": "Z",

    #// Display talos perf tests after correctness tests.
    "Talos Performance": "T",
    "Talos canvasmark": "cm",
    "Talos chrome": "c",
    "Talos dromaeojs": "d",
    "Talos dromaeojs Metro": "d-m",
    "Talos g1": "g1",
    "Talos other": "o",
    "Talos other Metro": "o-m",
    "Talos paint": "p",
    "Talos robocheck2": "rck2",
    "Talos robopan": "rp",
    "Talos roboprovider": "rpr",
    "Talos svg": "s",
    "Talos svg Metro": "s-m",
    "Talos tp": "tp",
    "Talos tp Metro": "tp-m",
    "Talos tp nochrome": "tpn",
    "Talos ts": "ts",
    "Talos tspaint": "tsp",
    "Talos xperf": "x",
    #// Sort unknown jobs after all others.
    "Unknown Unit Test": "U",
    "Unknown": "?",
}

NUMBER_RE = re.compile(".*(?:mochitest(?:-debug|-e10s|-devtools-chrome)?|reftest|crashtest|robocop|androidx86-set|browser-chrome|jittest)\-([0-9]+)", re.IGNORECASE)


def extract_platform_info(source_string):
    output = {
        'os': 'unknown',
        'os_platform': source_string[:24],
        'arch': 'unknown',
        'vm': extract_vm_status(source_string)
    }
    for platform in PLATFORMS_BUILDERNAME:
        if platform['regex'].search(source_string):
            output.update(platform['attributes'])
            return output
    return output


def extract_vm_status(source_string):
    vm = False
    for regex in VM_STATUS:
        if regex.search(source_string):
            return True
    return vm


def extract_build_type(source_string):
    output = 'opt'
    for build_type in BUILD_TYPE_BUILDERNAME:
        if build_type["regex"].search(source_string, re.IGNORECASE):
            output = build_type["type"]
            return output
    return output


def extract_job_type(source_string, default="build"):
    for job_type in JOB_TYPE_BUILDERNAME:
        for regex in JOB_TYPE_BUILDERNAME[job_type]:
            if regex.search(source_string):
                return job_type
    return default


def extract_name_info(source_string):
    """Extract all the pieces that comprise a name, including symbols"""
    output = {
        "name": "unknown",
        "job_symbol": "?",
        "group_name": "unknown",
        "group_symbol": "?",
    }

    for test_name in TEST_NAME_BUILDERNAME:
        if test_name["regex"].search(source_string):
            name = test_name["desc"]
            group_name = GROUP_NAMES.get(name, "unknown")
            group_symbol = SYMBOLS.get(group_name, "?")
            symbol = get_symbol(name, source_string)

            output.update({
                "name": name,
                "job_symbol": symbol,
                "group_name": group_name,
                "group_symbol": group_symbol
            })
            return output

    return output


def get_symbol(name, bn):
    """
    Determine the symbol based on the name and buildername

    May contain a number
    """

    s = SYMBOLS.get(name, "?")

    # Mochitests and Mochitest-e10s are the only ones that display
    # only as a number, no letters
    if s in ["M", "M-e10s"]:
        s = ""

    n = ""
    nummatch = NUMBER_RE.match(bn)
    if nummatch:
        n = nummatch.group(1)
    return "{0}{1}".format(s, n)


def get_device_or_unknown(job_name, vm):
    """
    retrieve the device name or unknown if no device is detected
    """
    position = job_name.find("Device")
    if position > 0:
        return job_name[0: position-1]
    elif vm is True:
        return "vm"
    else:
        return "unknown"
