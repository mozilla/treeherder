# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

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

# Buildernames use a mixture of spaces, underscores and hyphens as separators.
# Since \b doesn't match against underscores, we need to supplement it.
WORD_BOUNDARY_RE = r'(?:_|\b)'

# source for these is in ``Data.js.getMachine`` function.
PLATFORMS_BUILDERNAME = [

    # ** Linux **

    {
        'regex': re.compile(r'^b2g.*_(?:linux|ubuntu)64', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^(?:Linux|Ubuntu).*64 Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'mulet-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'(?:linux|ubuntu).*64.+|dxr', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^b2g.*_(?:linux|ubuntu)32', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'^(?:Linux|Ubuntu).*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'mulet-linux32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'linux|ubuntu', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux32',
            'arch': 'x86',
        }
    },

    # ** OS X **

    {
        'regex': re.compile(r'^b2g.*_macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'b2g-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^OS X.*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'mulet-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'Yosemite', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-10',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'OS X 10\.7|lion', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-8',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'snow[ ]?leopard', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-6',
            'arch': 'x86_64',
        }
    },

    # ** Windows **

    {
        'regex': re.compile(r'^b2g.*_win32', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'b2g-win32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'^Win32.*Mulet', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'mulet-win32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'WINNT 5|-xp-|Windows XP 32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windowsxp',
            'arch': 'x86',
        }
    },
    {
        # Windows x64 builds are created on Win Server 2k8, but for the sake
        # of consistency, we display them on the same row as the Win8 x64 tests.
        'regex': re.compile(r'WINNT 6\.1 x(?:86-)?64|Windows 8 64-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'win64_vm', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows2012-64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'WINNT 6\.1|win7|Windows 7 32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'WINNT 6\.2|win8', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-32',
            'arch': 'x86',
        }
    },

    # ** Android **

    {
        'regex': re.compile(r'android 4\.2 x86', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-2-x86',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'android (?:4\.0 )?armv7 api 10', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0-armv7-api10',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android (?:4\.0 )?armv7 api 11', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0-armv7-api11',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 4\.0', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android armv7 api 9', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-3-armv7-api9',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 2\.3 armv6', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-3-armv6',
            'arch': 'armv6',
        }
    },
    {
        'regex': re.compile(r'android 2\.3', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-3',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 2\.2 armv6', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2-armv6',
            'arch': 'armv6',
        }
    },
    {
        'regex': re.compile(r'android 2\.2', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2',
            'arch': 'armv7',
        }
    },

    # ** B2G **

    {
        'regex': re.compile(r'b2g.*_emulator-kk', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-kk',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'b2g.*_emulator-jb', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-jb',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'b2g.*_emulator(?:-ics)?', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-ics',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'b2g.*_(?:dep|nightly|periodic)$', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-device-image',
            'arch': 'armv7',
        }
    }
]

VM_STATUS = [
    re.compile(WORD_BOUNDARY_RE + r'vm' + WORD_BOUNDARY_RE, re.IGNORECASE)
]

BUILD_TYPE_BUILDERNAME = [
    {
        'type': 'pgo',
        'regex': re.compile(WORD_BOUNDARY_RE + r'pgo', re.IGNORECASE),
    },
    {
        'type': 'asan',
        'regex': re.compile(WORD_BOUNDARY_RE + r'asan', re.IGNORECASE),
    },
    {
        'type': 'cc',
        'regex': re.compile(WORD_BOUNDARY_RE + r'code coverage', re.IGNORECASE),
    },
    {
        'type': 'debug',
        'regex': re.compile(WORD_BOUNDARY_RE + r'(?:debug|leak test)', re.IGNORECASE),
    }
    # defaults to "opt" if not found
]

JOB_TYPE_BUILDERNAME = {
    'build': [
        re.compile(r'.+build'),
        re.compile(r'.+_dep'),
        re.compile(r'.+(?<!l10n)[ _]nightly$'),
        re.compile(r'.+ xulrunner$'),
        re.compile(r'.+ code coverage$'),
        re.compile(r'.*valgrind$'),
        re.compile(r'.*non-unified'),
    ],
    'unittest': [
        re.compile(r'jetpack.*(opt|debug)$'),
        re.compile(r'.+(?<!leak) test .+'),
    ],
    'talos': [re.compile(r'.+ talos .+')],
    'repack': [re.compile(r'.+ l10n .+')],
}

# from Data.js ``type`` Config.testNames and Config.buildNames
JOB_NAME_BUILDERNAME = [
    # ** Talos **
    {"regex": re.compile(r'talos remote-tcanvasmark$'), "desc": "Talos canvasmark"},
    {"regex": re.compile(r'talos chromez(-snow)?-e10s$'), "desc": "Talos chrome e10s"},
    {"regex": re.compile(r'talos chrome[z]?(-snow)?$'), "desc": "Talos chrome"},
    {"regex": re.compile(r'talos dromaeojs-e10s$'), "desc": "Talos dromaeojs e10s"},
    {"regex": re.compile(r'talos dromaeojs-metro$'), "desc": "Talos dromaeojs Metro"},
    {"regex": re.compile(r'talos dromaeojs$'), "desc": "Talos dromaeojs"},
    {"regex": re.compile(r'talos g1(-snow)?-e10s$'), "desc": "Talos g1 e10s"},
    {"regex": re.compile(r'talos g1(-snow)?$'), "desc": "Talos g1"},
    {"regex": re.compile(r'talos other(-snow)?-e10s'), "desc": "Talos other e10s"},
    {"regex": re.compile(r'talos other-metro$'), "desc": "Talos other Metro"},
    {"regex": re.compile(r'talos other'), "desc": "Talos other"},
    {"regex": re.compile(r'talos dirtypaint$'), "desc": "Talos paint"},
    {"regex": re.compile(r'talos remote-trobocheck2$'), "desc": "Talos robocheck2"},
    {"regex": re.compile(r'talos remote-trobopan$'), "desc": "Talos robopan"},
    {"regex": re.compile(r'talos remote-troboprovider$'), "desc": "Talos roboprovider"},
    {"regex": re.compile(r'talos (?:remote-t)?svg[rx]?(-snow)?-e10s$'), "desc": "Talos svg e10s"},
    {"regex": re.compile(r'talos (?:remote-t)?svg[rx]?-metro$'), "desc": "Talos svg Metro"},
    {"regex": re.compile(r'talos (?:remote-t)?svg[rx]?(-snow)?$'), "desc": "Talos svg"},
    {"regex": re.compile(r'talos tp5o-e10s$'), "desc": "Talos tp e10s"},
    {"regex": re.compile(r'talos tp5o-metro$'), "desc": "Talos tp Metro"},
    {"regex": re.compile(r'talos remote-tp4m_nochrome$'), "desc": "Talos tp nochrome"},
    {"regex": re.compile(r'talos (?:remote-)?tp'), "desc": "Talos tp"},
    {"regex": re.compile(r'talos remote-tspaint$'), "desc": "Talos tspaint"},
    {"regex": re.compile(r'talos remote-ts$'), "desc": "Talos ts"},
    {"regex": re.compile(r'talos xperf-e10s$'), "desc": "Talos xperf e10s"},
    {"regex": re.compile(r'talos xperf$'), "desc": "Talos xperf"},
    # ** Unit tests **
    {"regex": re.compile(r'mozbase$'), "desc": "Mozbase Unit Tests"},
    {"regex": re.compile(r'mochitest-csb'), "desc": "Mochitest csb"},
    {"regex": re.compile(r'mochitest-e10s-browser-chrome'), "desc": "Mochitest e10s Browser Chrome"},
    {"regex": re.compile(r'mochitest-e10s-devtools-chrome'), "desc": "Mochitest e10s DevTools Browser Chrome"},
    {"regex": re.compile(r'mochitest-e10s-other'), "desc": "Mochitest e10s Other"},
    {"regex": re.compile(r'mochitest-e10s'), "desc": "Mochitest e10s"},
    {"regex": re.compile(r'mochitest-browser-chrome'), "desc": "Mochitest Browser Chrome"},
    {"regex": re.compile(r'mochitest-devtools-chrome'), "desc": "Mochitest DevTools Browser Chrome"},
    {"regex": re.compile(r'mochitest-jetpack'), "desc": "Mochitest Jetpack"},
    {"regex": re.compile(r'mochitest-metro-chrome'), "desc": "Mochitest Metro Browser Chrome"},
    {"regex": re.compile(r'mochitest-other'), "desc": "Mochitest Other"},
    {"regex": re.compile(r'mochitest-(?:web)?gl'), "desc": "Mochitest WebGL"},
    {"regex": re.compile(r'mochitest-oop'), "desc": "Mochitest OOP"},
    {"regex": re.compile(r'mochitest'), "desc": "Mochitest"},
    {"regex": re.compile(r'webapprt-chrome$'), "desc": "Webapprt Chrome"},
    {"regex": re.compile(r'webapprt-content$'), "desc": "Webapprt Content"},
    {"regex": re.compile(r'web-platform-tests-reftests$'), "desc": "W3C Web Platform Reftests"},
    {"regex": re.compile(r'web-platform-tests'), "desc": "W3C Web Platform Tests"},
    {"regex": re.compile(r'robocop'), "desc": "Robocop"},
    {"regex": re.compile(r'crashtest-e10s'), "desc": "Crashtest e10s"},
    {"regex": re.compile(r'crashtest-ipc'), "desc": "Crashtest IPC"},
    {"regex": re.compile(r'crashtest'), "desc": "Crashtest"},
    {"regex": re.compile(r'jsreftest-e10s'), "desc": "JSReftest e10s"},
    {"regex": re.compile(r'jsreftest'), "desc": "JSReftest"},
    {"regex": re.compile(r'reftest-e10s'), "desc": "Reftest e10s"},
    {"regex": re.compile(r'reftest-sanity-oop$'), "desc": "Reftest Sanity OOP"},
    {"regex": re.compile(r'reftest-sanity$'), "desc": "Reftest Sanity"},
    {"regex": re.compile(r'reftest-ipc'), "desc": "Reftest IPC"},
    {"regex": re.compile(r'reftest-omtc'), "desc": "Reftest OMTC"},
    {"regex": re.compile(r'reftest-no-accel'), "desc": "Reftest Unaccelerated"},
    {"regex": re.compile(r'reftest'), "desc": "Reftest"},
    {"regex": re.compile(r'cppunit$'), "desc": "CPP Unit Tests"},
    {"regex": re.compile(r'jittest'), "desc": "JIT Tests"},
    {"regex": re.compile(r'jetpack'), "desc": "Jetpack SDK Test"},
    {"regex": re.compile(r'gaia-build-unit$'), "desc": "Gaia Build Unit Test"},
    {"regex": re.compile(r'gaia-build$'), "desc": "Gaia Build Test"},
    {"regex": re.compile(r'gaia-unit-oop$'), "desc": "Gaia Unit Test OOP"},
    {"regex": re.compile(r'gaia-unit$'), "desc": "Gaia Unit Test"},
    {"regex": re.compile(r'gaia-(?:js-)?integration-oop'), "desc": "Gaia JS Integration Test OOP"},
    {"regex": re.compile(r'gaia-(?:js-)?integration'), "desc": "Gaia JS Integration Test"},
    {"regex": re.compile(r'gaia-ui-test-oop-accessibility'), "desc": "Gaia Python Accessibility Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop-functional'), "desc": "Gaia Python Functional Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop-unit'), "desc": "Gaia Python Integration Unit Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop'), "desc": "Gaia Python Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-accessibility'), "desc": "Gaia Python Accessibility Integration Tests"},
    {"regex": re.compile(r'gaia-ui-test-functional'), "desc": "Gaia Python Functional Integration Tests"},
    {"regex": re.compile(r'gaia-ui-test-unit'), "desc": "Gaia Python Integration Unit Tests"},
    {"regex": re.compile(r'gaia-ui-test'), "desc": "Gaia Python Integration Tests"},
    {"regex": re.compile(r'linter$'), "desc": "Linter Test"},
    {"regex": re.compile(r'marionette-webapi$'), "desc": "Marionette WebAPI Tests"},
    {"regex": re.compile(r'marionette$'), "desc": "Marionette Framework Unit Tests"},
    {"regex": re.compile(r'marionette-e10s$'), "desc": "Marionette Framework Unit Tests e10s"},
    {"regex": re.compile(r'androidx86-set'), "desc": "Android x86 Test Set"},
    {"regex": re.compile(r'instrumentation-background'), "desc": "Android Instrumentation Background"},
    {"regex": re.compile(r'instrumentation-browser'), "desc": "Android Instrumentation Browser"},
    {"regex": re.compile(r'xpcshell'), "desc": "XPCShell"},
    {"regex": re.compile(r'mozmill$'), "desc": "Mozmill"},
    # ** Builds **
    # If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile(r'debug asan nightly'), "desc": "AddressSanitizer Debug Nightly"},
    {"regex": re.compile(r'asan nightly'), "desc": "AddressSanitizer Opt Nightly"},
    {"regex": re.compile(r'-sh-haz'), "desc": "SpiderMonkey Hazard Analysis Build"},
    {"regex": re.compile(r'-haz'), "desc": "Hazard Analysis Build"},
    {"regex": re.compile(r'xulrunner'), "desc": "XULRunner Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512_eng.*_nightly'), "desc": "Dolphin-512 Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_dolphin_eng.*_nightly'), "desc": "Dolphin Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame-kk_eng.*_nightly'), "desc": "Flame KitKat Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame_eng.*_nightly'), "desc": "Flame Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_hamachi_eng.*_nightly'), "desc": "Hamachi Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_helix_eng.*_nightly'), "desc": "Helix Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_inari_eng.*_nightly'), "desc": "Inari Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_leo_eng.*_nightly'), "desc": "Leo Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-4_eng.*_nightly'), "desc": "Nexus 4 Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-5-l_eng.*_nightly'), "desc": "Nexus 5-L Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_tarako_eng.*_nightly'), "desc": "Tarako Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_unagi_eng.*_nightly'), "desc": "Unagi Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_eng.*_nightly'), "desc": "Unknown B2G Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_emulator.*_nightly'), "desc": "B2G Emulator Image Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512.*_nightly'), "desc": "Dolphin-512 Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin.*_nightly'), "desc": "Dolphin Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_flame-kk.*_nightly'), "desc": "Flame KitKat Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_flame.*_nightly'), "desc": "Flame Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_hamachi.*_nightly'), "desc": "Hamachi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_helix.*_nightly'), "desc": "Helix Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_inari.*_nightly'), "desc": "Inari Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_leo.*_nightly'), "desc": "Leo Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nexus-4.*_nightly'), "desc": "Nexus 4 Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nexus-5-l.*_nightly'), "desc": "Nexus 5-L Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_tarako.*_nightly'), "desc": "Tarako Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_unagi.*_nightly'), "desc": "Unagi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_wasabi.*_nightly'), "desc": "Wasabi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nightly'), "desc": "Unknown B2G Device Image Nightly"},
    {"regex": re.compile(r'(?:l10n|localizer) nightly'), "desc": "L10n Nightly"},
    {"regex": re.compile(r'nightly'), "desc": "Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512_eng.*_(?:dep|periodic)'), "desc": "Dolphin-512 Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_dolphin_eng.*_(?:dep|periodic)'), "desc": "Dolphin Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame-kk_eng.*_(?:dep|periodic)'), "desc": "Flame KitKat Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame_eng.*_(?:dep|periodic)'), "desc": "Flame Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_hamachi_eng.*_(?:dep|periodic)'), "desc": "Hamachi Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_helix_eng.*_(?:dep|periodic)'), "desc": "Helix Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_inari_eng.*_(?:dep|periodic)'), "desc": "Inari Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_leo_eng.*_(?:dep|periodic)'), "desc": "Leo Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-4_eng.*_(?:dep|periodic)'), "desc": "Nexus 4 Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-5-l_eng.*_(?:dep|periodic)'), "desc": "Nexus 5-L Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_tarako_eng.*_(?:dep|periodic)'), "desc": "Tarako Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_unagi_eng.*_(?:dep|periodic)'), "desc": "Unagi Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_eng.*_(?:dep|periodic)'), "desc": "Unknown B2G Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_emulator.*_nonunified'), "desc": "B2G Emulator Image Non-Unified Build"},
    {"regex": re.compile(r'b2g.*_emulator.*_(?:dep|periodic)'), "desc": "B2G Emulator Image Build"},
    {"regex": re.compile(r'b2g.*_dolphin-512.*_(?:dep|periodic)'), "desc": "Dolphin-512 Device Image Build"},
    {"regex": re.compile(r'b2g.*_dolphin.*_(?:dep|periodic)'), "desc": "Dolphin Device Image Build"},
    {"regex": re.compile(r'b2g.*_flame-kk.*_(?:dep|periodic)'), "desc": "Flame KitKat Device Image Build"},
    {"regex": re.compile(r'b2g.*_flame.*_(?:dep|periodic)'), "desc": "Flame Device Image Build"},
    {"regex": re.compile(r'b2g.*_hamachi.*_(?:dep|periodic)'), "desc": "Hamachi Device Image Build"},
    {"regex": re.compile(r'b2g.*_helix.*_(?:dep|periodic)'), "desc": "Helix Device Image Build"},
    {"regex": re.compile(r'b2g.*_inari.*_(?:dep|periodic)'), "desc": "Inari Device Image Build"},
    {"regex": re.compile(r'b2g.*_leo.*_(?:dep|periodic)'), "desc": "Leo Device Image Build"},
    {"regex": re.compile(r'b2g.*_nexus-4.*_(?:dep|periodic)'), "desc": "Nexus 4 Device Image Build"},
    {"regex": re.compile(r'b2g.*_nexus-5-l.*_(?:dep|periodic)'), "desc": "Nexus 5-L Device Image Build"},
    {"regex": re.compile(r'b2g.*_tarako.*_(?:dep|periodic)'), "desc": "Tarako Device Image Build"},
    {"regex": re.compile(r'b2g.*_unagi.*_(?:dep|periodic)'), "desc": "Unagi Device Image Build"},
    {"regex": re.compile(r'b2g.*_wasabi.*_(?:dep|periodic)'), "desc": "Wasabi Device Image Build"},
    {"regex": re.compile(r'b2g.*_(?:dep|periodic)'), "desc": "Unknown B2G Device Image Build"},
    {"regex": re.compile(r'spidermonkey.*-arm-sim'), "desc": "SpiderMonkey ARM Simulator Build"},
    {"regex": re.compile(r'spidermonkey.*-dtrace'), "desc": "SpiderMonkey DTrace Build"},
    {"regex": re.compile(r'spidermonkey.*-warnaserr'), "desc": "SpiderMonkey Fail-On-Warnings Build"},
    {"regex": re.compile(r'spidermonkey.*-exactroot'), "desc": "SpiderMonkey Exact Rooting Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-generational'), "desc": "SpiderMonkey GGC Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-rootanalysis'), "desc": "SpiderMonkey Root Analysis Build"},
    # If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile(r'debug asan build'), "desc": "AddressSanitizer Debug Build"},
    {"regex": re.compile(r'asan build'), "desc": "AddressSanitizer Opt Build"},
    {"regex": re.compile(r'non[-]?unified'), "desc": "Non-Unified Build"},
    {"regex": re.compile(r'static analysis'), "desc": "Static Checking Build"},
    {"regex": re.compile(r'valgrind'), "desc": "Valgrind Build"},
    {"regex": re.compile(r'dxr'), "desc": "DXR Index Build"},
    {"regex": re.compile(r'(build|dep|periodic)$'), "desc": "Build"},
]

# map test names to group names as "<testname>": "<groupname>"
# when updating, please take care to ensure the ``testname`` AND the
# ``groupname`` exist in the ``SYMBOLS`` dict as well.
GROUP_NAMES = {
    "Dolphin Device Image Build": "Dolphin Device Image",
    "Dolphin Device Image Build (Engineering)": "Dolphin Device Image",
    "Dolphin Device Image Nightly": "Dolphin Device Image",
    "Dolphin Device Image Nightly (Engineering)": "Dolphin Device Image",
    "Dolphin-512 Device Image Build": "Dolphin-512 Device Image",
    "Dolphin-512 Device Image Build (Engineering)": "Dolphin-512 Device Image",
    "Dolphin-512 Device Image Nightly": "Dolphin-512 Device Image",
    "Dolphin-512 Device Image Nightly (Engineering)": "Dolphin-512 Device Image",
    "Flame Device Image Build": "Flame Device Image",
    "Flame Device Image Build (Engineering)": "Flame Device Image",
    "Flame Device Image Nightly": "Flame Device Image",
    "Flame Device Image Nightly (Engineering)": "Flame Device Image",
    "Flame KitKat Device Image Build": "Flame KitKat Device Image",
    "Flame KitKat Device Image Build (Engineering)": "Flame KitKat Device Image",
    "Flame KitKat Device Image Nightly": "Flame KitKat Device Image",
    "Flame KitKat Device Image Nightly (Engineering)": "Flame KitKat Device Image",
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
    "Nexus 5-L Device Image Build": "Nexus 5-L Device Image",
    "Nexus 5-L Device Image Build (Engineering)": "Nexus 5-L Device Image",
    "Nexus 5-L Device Image Nightly": "Nexus 5-L Device Image",
    "Nexus 5-L Device Image Nightly (Engineering)": "Nexus 5-L Device Image",
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
    "Mochitest Browser Chrome": "Mochitest",
    "Mochitest DevTools Browser Chrome": "Mochitest",
    "Mochitest WebGL": "Mochitest",
    "Mochitest Jetpack": "Mochitest",
    "Mochitest Metro Browser Chrome": "Mochitest",
    "Mochitest Other": "Mochitest",
    "Webapprt Content": "Mochitest",
    "Webapprt Chrome": "Mochitest",
    "Robocop": "Mochitest",
    "Mochitest e10s": "Mochitest e10s",
    "Mochitest e10s Browser Chrome": "Mochitest e10s",
    "Mochitest e10s DevTools Browser Chrome": "Mochitest e10s",
    "Mochitest e10s Other": "Mochitest e10s",
    "Mochitest csb": "Mochitest csb",
    "Mochitest OOP": "Mochitest OOP",
    "Crashtest": "Reftest",
    "Crashtest IPC": "Reftest",
    "Reftest": "Reftest",
    "Reftest Unaccelerated": "Reftest",
    "Reftest IPC": "Reftest",
    "Reftest OMTC": "Reftest",
    "Reftest Sanity": "Reftest",
    "JSReftest": "Reftest",
    "Crashtest e10s": "Reftest e10s",
    "JSReftest e10s": "Reftest e10s",
    "Reftest e10s": "Reftest e10s",
    "Reftest Sanity OOP": "Reftest Sanity OOP",
    "Gaia JS Integration Test": "Gaia JS Integration Test",
    "Gaia JS Integration Test OOP": "Gaia JS Integration Test OOP",
    "Gaia Python Integration Tests": "Gaia Python Integration Tests",
    "Gaia Python Accessibility Integration Tests": "Gaia Python Integration Tests",
    "Gaia Python Functional Integration Tests": "Gaia Python Integration Tests",
    "Gaia Python Integration Unit Tests": "Gaia Python Integration Tests",
    "Gaia Python Integration Tests OOP": "Gaia Python Integration Tests OOP",
    "Gaia Python Accessibility Integration Tests OOP": "Gaia Python Integration Tests OOP",
    "Gaia Python Functional Integration Tests OOP": "Gaia Python Integration Tests OOP",
    "Gaia Python Integration Unit Tests OOP": "Gaia Python Integration Tests OOP",
    "SpiderMonkey ARM Simulator Build": "SpiderMonkey",
    "SpiderMonkey DTrace Build": "SpiderMonkey",
    "SpiderMonkey Fail-On-Warnings Build": "SpiderMonkey",
    "SpiderMonkey Exact Rooting Shell Build": "SpiderMonkey",
    "SpiderMonkey GGC Shell Build": "SpiderMonkey",
    "SpiderMonkey Hazard Analysis Build": "SpiderMonkey",
    "SpiderMonkey Root Analysis Build": "SpiderMonkey",
    "W3C Web Platform Tests": "W3C Web Platform Tests",
    "W3C Web Platform Reftests": "W3C Web Platform Tests",
    "Android Instrumentation Background": "Android Instrumentation Tests",
    "Android Instrumentation Browser": "Android Instrumentation Tests",
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
    "Talos xperf": "Talos Performance",
    "Talos chrome e10s": "Talos Performance e10s",
    "Talos dromaeojs e10s": "Talos Performance e10s",
    "Talos g1 e10s": "Talos Performance e10s",
    "Talos other e10s": "Talos Performance e10s",
    "Talos svg e10s": "Talos Performance e10s",
    "Talos tp e10s": "Talos Performance e10s",
    "Talos xperf e10s": "Talos Performance e10s",
}

# symbols displayed in the UI for all jobs and job groups
# from ``buildNames`` and ``testNames`` in ``Config.js`` file
SYMBOLS = {
    # Builds

    # ** Dep Builds **
    "Build": "B",
    "Non-Unified Build": "Bn",
    "Static Checking Build": "S",
    "SpiderMonkey": "SM",
    "SpiderMonkey ARM Simulator Build": "arm",
    "SpiderMonkey DTrace Build": "d",
    "SpiderMonkey Fail-On-Warnings Build": "e",
    "SpiderMonkey Exact Rooting Shell Build": "exr",
    "SpiderMonkey GGC Shell Build": "ggc",
    "SpiderMonkey Hazard Analysis Build": "H",
    "SpiderMonkey Root Analysis Build": "r",
    # ** Nightly Builds **
    "Nightly": "N",
    "DXR Index Build": "Dxr",
    "Hazard Analysis Build": "H",
    "Valgrind Build": "V",
    "XULRunner Nightly": "Xr",
    # ** Special Builds **
    # If we start doing debug ASan tests, please
    # kill these special build types
    "AddressSanitizer Opt Build": "Bo",
    "AddressSanitizer Debug Build": "Bd",
    "AddressSanitizer Opt Nightly": "No",
    "AddressSanitizer Debug Nightly": "Nd",
    # L10n nightlies are grouped above so they appear as N1, N2, etc.
    "L10n Nightly": "N",
    "L10n Repack": "L10n",
    "B2G Emulator Image Build": "B",
    "B2G Emulator Image Non-Unified Build": "Bn",
    "B2G Emulator Image Nightly": "N",
    # B2G device image builds (grouped by device in the UI)
    "Dolphin Device Image": "Dolphin",
    "Dolphin Device Image Build": "B",
    "Dolphin Device Image Build (Engineering)": "Be",
    "Dolphin Device Image Nightly": "N",
    "Dolphin Device Image Nightly (Engineering)": "Ne",
    "Dolphin-512 Device Image": "Dolphin-512",
    "Dolphin-512 Device Image Build": "B",
    "Dolphin-512 Device Image Build (Engineering)": "Be",
    "Dolphin-512 Device Image Nightly": "N",
    "Dolphin-512 Device Image Nightly (Engineering)": "Ne",
    "Flame Device Image": "Flame",
    "Flame Device Image Build": "B",
    "Flame Device Image Build (Engineering)": "Be",
    "Flame Device Image Nightly": "N",
    "Flame Device Image Nightly (Engineering)": "Ne",
    "Flame KitKat Device Image": "Flame-KK",
    "Flame KitKat Device Image Build": "B",
    "Flame KitKat Device Image Build (Engineering)": "Be",
    "Flame KitKat Device Image Nightly": "N",
    "Flame KitKat Device Image Nightly (Engineering)": "Ne",
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
    "Nexus 5-L Device Image": "Nexus 5-L",
    "Nexus 5-L Device Image Build": "B",
    "Nexus 5-L Device Image Build (Engineering)": "Be",
    "Nexus 5-L Device Image Nightly": "N",
    "Nexus 5-L Device Image Nightly (Engineering)": "Ne",
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

    # Tests

    # Mozbase is kind of a "glue" test suite between builds and all other tests,
    # so we list it first to make any bustage more obvious.
    "Mozbase Unit Tests": "Mb",
    # Mochitests and reftests come next since they're the most common tests
    # run across all platforms and therefore benefit from better vertical alignment.
    "Mochitest": "M",
    "Mochitest Browser Chrome": "bc",
    "Mochitest DevTools Browser Chrome": "dt",
    "Mochitest WebGL": "gl",
    "Mochitest Jetpack": "JP",
    "Mochitest Metro Browser Chrome": "mc",
    "Mochitest Other": "oth",
    "Mochitest e10s": "M-e10s",
    "Mochitest e10s Browser Chrome": "bc",
    "Mochitest e10s DevTools Browser Chrome": "dt",
    "Mochitest e10s Other": "oth",
    "Mochitest csb": "M-csb",
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
    "Reftest Sanity OOP": "Rs-oop",
    "Reftest IPC": "Ripc",
    "Reftest OMTC": "Ro",
    "Reftest Sanity": "Rs",
    "Reftest Unaccelerated": "Ru",
    "W3C Web Platform Tests": "W",
    "W3C Web Platform Reftests": "Wr",
    "Android Instrumentation Tests": "I",
    "Android Instrumentation Background": "Ba",
    "Android Instrumentation Browser": "Br",

    # All other unit tests, sorted alphabetically by symbol.
    "CPP Unit Tests": "Cpp",
    "JIT Tests": "Jit",
    "Jetpack SDK Test": "JP",
    "Gaia Build Test": "Gb",
    "Gaia Build Unit Test": "Gbu",
    "Gaia JS Integration Test": "Gij",
    "Gaia JS Integration Test OOP": "Gij-oop",
    "Gaia Python Integration Tests": "Gip",
    "Gaia Python Accessibility Integration Tests": "a",
    "Gaia Python Functional Integration Tests": "f",
    "Gaia Python Integration Unit Tests": "u",
    "Gaia Python Integration Tests OOP": "Gip-oop",
    "Gaia Python Accessibility Integration Tests OOP": "a",
    "Gaia Python Functional Integration Tests OOP": "f",
    "Gaia Python Integration Unit Tests OOP": "u",
    "Gaia Unit Test": "Gu",
    "Gaia Unit Test OOP": "Gu-oop",
    "Linter Test": "Li",
    "Marionette Framework Unit Tests": "Mn",
    "Marionette Framework Unit Tests e10s": "Mn-e10s",
    "Marionette WebAPI Tests": "Mnw",
    "Android x86 Test Set": "S",
    "Android x86 Test Combos": "Sets",
    "XPCShell": "X",
    "Mozmill": "Z",

    # Display talos perf tests after correctness tests.
    "Talos Performance": "T",
    "Talos Performance e10s": "T-e10s",
    "Talos canvasmark": "cm",
    "Talos chrome": "c",
    "Talos chrome e10s": "c",
    "Talos dromaeojs": "d",
    "Talos dromaeojs e10s": "d",
    "Talos dromaeojs Metro": "d-m",
    "Talos g1": "g1",
    "Talos g1 e10s": "g1",
    "Talos other": "o",
    "Talos other e10s": "o",
    "Talos other Metro": "o-m",
    "Talos paint": "p",
    "Talos robocheck2": "rck2",
    "Talos robopan": "rp",
    "Talos roboprovider": "rpr",
    "Talos svg": "s",
    "Talos svg e10s": "s",
    "Talos svg Metro": "s-m",
    "Talos tp": "tp",
    "Talos tp e10s": "tp",
    "Talos tp Metro": "tp-m",
    "Talos tp nochrome": "tpn",
    "Talos ts": "ts",
    "Talos tspaint": "tsp",
    "Talos xperf": "x",
    "Talos xperf e10s": "x",
    # Sort unknown jobs after all others.
    "Unknown Unit Test": "U",
    "Unknown": "?",
}

# Match the job part number from buildernames such as "... mochitest-5"
NUMBER_RE = re.compile(r".*-(\d+)$")


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
        if build_type["regex"].search(source_string):
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

    for test_name in JOB_NAME_BUILDERNAME:
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

    nummatch = NUMBER_RE.match(bn)
    n = nummatch.group(1) if nummatch else ""

    # For multi-part Mochitest, Mochitest-e10s, Mochitest OOP & W3C Web Platform
    # jobs, display only the job part number and not the letters.
    if n and s in ["M", "M-e10s", "M-csb", "M-oop", "Gij", "Gij-oop", "W"]:
        return n

    return "{0}{1}".format(s, n)


def get_device_or_unknown(job_name, vm):
    """
    retrieve the device name or unknown if no device is detected
    """
    position = job_name.find("Device")
    if position > 0:
        return job_name[0: position - 1]
    elif vm is True:
        return "vm"
    else:
        return "unknown"
