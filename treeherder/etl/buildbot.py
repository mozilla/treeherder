import re

RESULT_DICT = {
    0: "success",
    1: "testfailed",
    2: "busted",
    3: "skipped",
    4: "exception",
    5: "retry",
    6: "usercancel",
    7: "superseded"
}

####
#   The following variables were taken from util.py
#
#   PLATFORMS_BUILDERNAME, BUILD_TYPE_BUILDERNAME
#
#   https://dxr.mozilla.org/build-central/source/buildapi/buildapi/model/util.py
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
        'regex': re.compile(r'^graphene.*_linux64', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'graphene-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^horizon.*_linux64', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'horizon-linux64',
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
        'regex': re.compile(r'^(?:Linux|Ubuntu).*64 qr', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64-qr',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'Windows 10 64-bit.*stylo-disabled.*test.*', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows10-64-stylo-disabled',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^(?:Linux|Ubuntu).*64 Stylo-sequential', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64-stylo-sequential',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^(?:Linux|Ubuntu).*64 Stylo', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64-stylo',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^(?:Linux|Ubuntu).*64 devedition', re.IGNORECASE),
        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64-devedition',
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
        'regex': re.compile(r'^graphene.*_macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'graphene-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^horizon.*_macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'horizon-osx',
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
        'regex': re.compile(r'(Yosemite|macosx64).*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-10-devedition',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'(OS X 10\.7|lion).*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-7-devedition',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'Yosemite|macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-10',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'OS X 10\.8|mountain lion', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-8',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'OS X 10\.7|lion', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-7',
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
        'regex': re.compile(r'(WINNT 5|-xp-|Windows XP 32-bit).*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windowsxp-devedition',
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
        'regex': re.compile(r'^graphene.*_win64', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'graphene-win64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'^horizon.*_win64', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'horizon-win64',
            'arch': 'x86_64',
        }
    },
    {
        # Windows x64 builds are created on Win Server 2k8, but for the sake
        # of consistency, we display them on the same row as the Win8 x64 tests.
        'regex': re.compile(r'(WINNT 6\.1 x(?:86-)?64|Windows 8 64-bit|win64).*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-64-devedition',
            'arch': 'x86_64',
        }
    },
    {
        # Windows x64 builds are created on Win Server 2k8, but for the sake
        # of consistency, we display them on the same row as the Win8 x64 tests.
        'regex': re.compile(r'WINNT 6\.1 x(?:86-)?64|Windows 8 64-bit|win64', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-64',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile(r'Windows 10 64-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows10-64',
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
        'regex': re.compile(r'(WINNT 6\.1|win7|Windows 7 32-bit).*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32-devedition',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'Windows 7 32-bit.*stylo-disabled.*test.*', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32-stylo-disabled',
            'arch': 'x86',
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
        'regex': re.compile(r'Windows 7 VM.*32-bit.*devedition', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32-vm-devedition',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'Windows 7 VM.*32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32-vm',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'WINNT 6\.2|win8|win32', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-32',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile(r'Windows 10 32-bit', re.IGNORECASE),
        'attributes': {
            'os': 'win',
            'os_platform': 'windows10-32',
            'arch': 'x86',
        }
    },

    # ** Android **

    {
        'regex': re.compile(r'android 4\.4 armv7 api 11', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-4-armv7-api11',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 4\.3 armv7 api 11', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-3-armv7-api11',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 4\.4 armv7 api 15', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-4-armv7-api15',
            'arch': 'armv7',
        }
    },
    {
        'regex': re.compile(r'android 4\.3 armv7 api 15', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-3-armv7-api15',
            'arch': 'armv7',
        }
    },
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
        'regex': re.compile(r'android (?:4\.0 )?armv7 api 15', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0-armv7-api15',
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
        'regex': re.compile(r'b2g.*_emulator-l', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-l',
            'arch': 'armv7',
        }
    },
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
    },
    # Release Promotion Jobs
    # These aren't associated with a particular platform, nor is platform information included in their buildername
    {
        'regex': re.compile(r'.*_(?:bncr_sub|bouncer_aliases|uptake_monitoring|chcksms|updates|version_bump)$', re.IGNORECASE),
        'attributes': {
            'os': '-',
            'os_platform': 'other',
            'arch': '-',
        }
    }
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
        'type': 'tsan',
        'regex': re.compile(WORD_BOUNDARY_RE + r'tsan', re.IGNORECASE),
    },
    {
        'type': 'cc',
        'regex': re.compile(WORD_BOUNDARY_RE + r'code coverage', re.IGNORECASE),
    },
    {
        'type': 'debug',
        'regex': re.compile(WORD_BOUNDARY_RE + r'(?:debug|leak test)', re.IGNORECASE),
    },
    {
        'type': 'addon',
        'regex': re.compile(WORD_BOUNDARY_RE + r'add-on-devel', re.IGNORECASE),
    }
    # defaults to "opt" if not found
]

# from Data.js ``type`` Config.testNames and Config.buildNames
JOB_NAME_BUILDERNAME = [
    # ** Talos **
    {"regex": re.compile(r'talos chromez-stylo-e10s$'), "name": "Talos Stylo chrome e10s"},
    {"regex": re.compile(r'talos chromez-stylo-disabled-e10s$'), "name": "Talos Stylo disabled chrome e10s"},
    {"regex": re.compile(r'talos chromez-profiling-e10s$'), "name": "Talos Profiling chrome e10s"},
    {"regex": re.compile(r'talos chromez-e10s$'), "name": "Talos chrome e10s"},
    {"regex": re.compile(r'talos dromaeojs-stylo-e10s$'), "name": "Talos Stylo dromaeojs e10s"},
    {"regex": re.compile(r'talos dromaeojs-stylo-disabled-e10s$'), "name": "Talos Stylo disabled dromaeojs e10s"},
    {"regex": re.compile(r'talos dromaeojs-profiling-e10s$'), "name": "Talos Profiling dromaeojs e10s"},
    {"regex": re.compile(r'talos dromaeojs-e10s$'), "name": "Talos dromaeojs e10s"},
    {"regex": re.compile(r'talos g1-stylo-e10s$'), "name": "Talos Stylo g1 e10s"},
    {"regex": re.compile(r'talos g1-stylo-disabled-e10s$'), "name": "Talos Stylo disabled g1 e10s"},
    {"regex": re.compile(r'talos g1-profiling-e10s$'), "name": "Talos Profiling g1 e10s"},
    {"regex": re.compile(r'talos g1-e10s$'), "name": "Talos g1 e10s"},
    {"regex": re.compile(r'talos g2-stylo-e10s$'), "name": "Talos Stylo g2 e10s"},
    {"regex": re.compile(r'talos g2-stylo-disabled-e10s$'), "name": "Talos Stylo disabled g2 e10s"},
    {"regex": re.compile(r'talos g2-profiling-e10s$'), "name": "Talos Profiling g2 e10s"},
    {"regex": re.compile(r'talos g2-e10s$'), "name": "Talos g2 e10s"},
    {"regex": re.compile(r'talos g3-stylo-e10s$'), "name": "Talos Stylo g3 e10s"},
    {"regex": re.compile(r'talos g3-stylo-disabled-e10s$'), "name": "Talos Stylo disabled g3 e10s"},
    {"regex": re.compile(r'talos g3-profiling-e10s$'), "name": "Talos Profiling g3 e10s"},
    {"regex": re.compile(r'talos g3-e10s$'), "name": "Talos g3 e10s"},
    {"regex": re.compile(r'talos g4-stylo-e10s$'), "name": "Talos Stylo g4 e10s"},
    {"regex": re.compile(r'talos g4-stylo-disabled-e10s$'), "name": "Talos Stylo disabled g4 e10s"},
    {"regex": re.compile(r'talos g4-profiling-e10s$'), "name": "Talos Profiling g4 e10s"},
    {"regex": re.compile(r'talos g4-e10s$'), "name": "Talos g4 e10s"},
    {"regex": re.compile(r'talos g5-stylo-e10s$'), "name": "Talos Stylo g5 e10s"},
    {"regex": re.compile(r'talos g5-stylo-disabled-e10s$'), "name": "Talos Stylo disabled g5 e10s"},
    {"regex": re.compile(r'talos g5-profiling-e10s$'), "name": "Talos Profiling g5 e10s"},
    {"regex": re.compile(r'talos g5-e10s$'), "name": "Talos g5 e10s"},
    {"regex": re.compile(r'talos other-stylo-e10s'), "name": "Talos Stylo other e10s"},
    {"regex": re.compile(r'talos other-stylo-disabled-e10s'), "name": "Talos Stylo disabled other e10s"},
    {"regex": re.compile(r'talos other-profiling-e10s'), "name": "Talos Profiling other e10s"},
    {"regex": re.compile(r'talos other-e10s'), "name": "Talos other e10s"},
    {"regex": re.compile(r'talos svgr-stylo-e10s$'), "name": "Talos Stylo svg e10s"},
    {"regex": re.compile(r'talos svgr-stylo-disabled-e10s$'), "name": "Talos Stylo disabled svg e10s"},
    {"regex": re.compile(r'talos svgr-profiling-e10s$'), "name": "Talos Profiling svg e10s"},
    {"regex": re.compile(r'talos svgr-e10s$'), "name": "Talos svg e10s"},
    {"regex": re.compile(r'talos (?:remote-t)?svg[r]?$'), "name": "Talos svg"},
    {"regex": re.compile(r'talos tp5o-stylo-e10s$'), "name": "Talos Stylo tp e10s"},
    {"regex": re.compile(r'talos tp5o-stylo-disabled-e10s$'), "name": "Talos Stylo disabled tp e10s"},
    {"regex": re.compile(r'talos tp5o-profiling-e10s$'), "name": "Talos Profiling tp e10s"},
    {"regex": re.compile(r'talos tp5o-e10s$'), "name": "Talos tp e10s"},
    {"regex": re.compile(r'talos remote-tp4m_nochrome$'), "name": "Talos tp nochrome"},
    {"regex": re.compile(r'talos xperf-stylo-e10s$'), "name": "Talos Stylo xperf e10s"},
    {"regex": re.compile(r'talos xperf-stylo-disabled-e10s$'), "name": "Talos Stylo disabled xperf e10s"},
    {"regex": re.compile(r'talos xperf-profiling-e10s$'), "name": "Talos Profiling xperf e10s"},
    {"regex": re.compile(r'talos xperf-e10s$'), "name": "Talos xperf e10s"},
    {"regex": re.compile(r'talos perf-reftest-stylo-e10s$'), "name": "Talos Stylo perf-reftest e10s"},
    {"regex": re.compile(r'talos perf-reftest-stylo-disabled-e10s$'), "name": "Talos Stylo disabled perf-reftest e10s"},
    {"regex": re.compile(r'talos perf-reftest-profiling-e10s$'), "name": "Talos Profiling perf-reftest e10s"},
    {"regex": re.compile(r'talos perf-reftest-e10s$'), "name": "Talos perf-reftest e10s"},
    {"regex": re.compile(r'talos perf-reftest-singletons-stylo-e10s$'), "name": "Talos Stylo perf-reftest-singletons e10s"},
    {"regex": re.compile(r'talos perf-reftest-singletons-stylo-disabled-e10s$'), "name": "Talos Stylo disabled perf-reftest-singletons e10s"},
    {"regex": re.compile(r'talos perf-reftest-singletons-profiling-e10s$'), "name": "Talos Profiling perf-reftest-singletons e10s"},
    {"regex": re.compile(r'talos perf-reftest-singletons-e10s$'), "name": "Talos perf-reftest-singletons e10s"},
    {"regex": re.compile(r'talos quantum-pageload-e10s$'), "name": "Talos tp6 e10s"},
    {"regex": re.compile(r'talos quantum-pageload-stylo-e10s$'), "name": "Talos Stylo tp6 e10s"},
    {"regex": re.compile(r'talos tp6-e10s$'), "name": "Talos tp6 e10s"},
    {"regex": re.compile(r'talos tp6-stylo-e10s$'), "name": "Talos Stylo tp6 e10s"},
    {"regex": re.compile(r'talos tp6-stylo-disabled-e10s$'), "name": "Talos Stylo disabled tp6 e10s"},
    {"regex": re.compile(r'talos tp6-stylo-threads-e10s$'), "name": "Talos Stylo sequential tp6 e10s"},
    {"regex": re.compile(r'talos tp6-profiling-e10s$'), "name": "Talos Profiling tp6 e10s"},
    {"regex": re.compile(r'talos speedometer-e10s$'), "name": "Talos speedometer e10s"},
    {"regex": re.compile(r'talos speedometer-stylo-disabled-e10s$'), "name": "Talos Stylo disabled speedometer e10s"},
    {"regex": re.compile(r'talos speedometer-profiling-e10s$'), "name": "Talos Profiling speedometer e10s"},
    {"regex": re.compile(r'talos h1-e10s$'), "name": "Talos h1 e10s"},
    {"regex": re.compile(r'talos h2-e10s$'), "name": "Talos h2 e10s"},
    # ** Unit tests **
    {"regex": re.compile(r'mozbase$'), "name": "Mozbase Unit Tests"},
    {"regex": re.compile(r'mochitest-csb'), "name": "Mochitest csb"},
    {"regex": re.compile(r'mochitest-e10s-browser-chrome'), "name": "Mochitest e10s Browser Chrome"},
    {"regex": re.compile(r'mochitest-e10s-devtools-chrome'), "name": "Mochitest e10s DevTools Browser Chrome"},
    {"regex": re.compile(r'mochitest-e10s-other'), "name": "Mochitest e10s Other"},
    {"regex": re.compile(r'mochitest-(?:web)?gl-e10s'), "name": "Mochitest e10s WebGL"},
    {"regex": re.compile(r'mochitest-e10s'), "name": "Mochitest e10s"},
    {"regex": re.compile(r'mochitest-browser-chrome'), "name": "Mochitest Browser Chrome"},
    {"regex": re.compile(r'mochitest-browser-screenshots'), "name": "Mochitest Browser Screenshots"},
    {"regex": re.compile(r'mochitest-devtools-chrome'), "name": "Mochitest DevTools Browser Chrome"},
    {"regex": re.compile(r'mochitest-jetpack'), "name": "Mochitest Jetpack"},
    {"regex": re.compile(r'mochitest-metro-chrome'), "name": "Mochitest Metro Browser Chrome"},
    {"regex": re.compile(r'mochitest-a11y'), "name": "Mochitest a11y"},
    {"regex": re.compile(r'mochitest-other'), "name": "Mochitest Other"},
    {"regex": re.compile(r'mochitest-(?:web)?gl'), "name": "Mochitest WebGL"},
    {"regex": re.compile(r'mochitest-oop'), "name": "Mochitest OOP"},
    {"regex": re.compile(r'mochitest-chrome'), "name": "Mochitest Chrome"},
    {"regex": re.compile(r'mochitest-push-e10s'), "name": "Mochitest e10s Push"},
    {"regex": re.compile(r'mochitest-push'), "name": "Mochitest Push"},
    {"regex": re.compile(r'mochitest-media-e10s'), "name": "Mochitest e10s Media"},
    {"regex": re.compile(r'mochitest-media'), "name": "Mochitest Media"},
    {"regex": re.compile(r'mochitest-gpu-e10s'), "name": "Mochitest e10s GPU"},
    {"regex": re.compile(r'mochitest-gpu'), "name": "Mochitest GPU"},
    {"regex": re.compile(r'mochitest-clipboard-e10s'), "name": "Mochitest e10s Clipboard"},
    {"regex": re.compile(r'mochitest-clipboard'), "name": "Mochitest Clipboard"},
    {"regex": re.compile(r'mochitest'), "name": "Mochitest"},
    {"regex": re.compile(r'webapprt-chrome$'), "name": "Webapprt Chrome"},
    {"regex": re.compile(r'webapprt-content$'), "name": "Webapprt Content"},
    {"regex": re.compile(r'web-platform-tests-reftests-e10s$'), "name": "W3C Web Platform Reftests e10s"},
    {"regex": re.compile(r'web-platform-tests-e10s'), "name": "W3C Web Platform Tests e10s"},
    {"regex": re.compile(r'web-platform-tests-reftests$'), "name": "W3C Web Platform Reftests"},
    {"regex": re.compile(r'web-platform-tests'), "name": "W3C Web Platform Tests"},
    {"regex": re.compile(r'robocop'), "name": "Robocop"},
    {"regex": re.compile(r'crashtest-e10s'), "name": "Crashtest e10s"},
    {"regex": re.compile(r'crashtest'), "name": "Crashtest"},
    {"regex": re.compile(r'jsreftest-e10s'), "name": "JSReftest e10s"},
    {"regex": re.compile(r'jsreftest'), "name": "JSReftest"},
    {"regex": re.compile(r'reftest-e10s'), "name": "Reftest e10s"},
    {"regex": re.compile(r'reftest-sanity-oop$'), "name": "Reftest Sanity OOP"},
    {"regex": re.compile(r'reftest-sanity$'), "name": "Reftest Sanity"},
    {"regex": re.compile(r'reftest-no-accel-e10s'), "name": "Reftest Unaccelerated e10s"},
    {"regex": re.compile(r'reftest-no-accel'), "name": "Reftest Unaccelerated"},
    {"regex": re.compile(r'reftest-gpu-e10s'), "name": "Reftest GPU e10s"},
    {"regex": re.compile(r'reftest-gpu'), "name": "Reftest GPU"},
    {"regex": re.compile(r'reftest-qr-e10s'), "name": "Reftest QR e10s"},
    {"regex": re.compile(r'reftest'), "name": "Reftest"},
    {"regex": re.compile(r'cppunit$'), "name": "CPP Unit Tests"},
    {"regex": re.compile(r'jittest'), "name": "JIT Tests"},
    {"regex": re.compile(r'jetpack'), "name": "Jetpack SDK Test"},
    {"regex": re.compile(r'gaia-build-unit$'), "name": "Gaia Build Unit Test"},
    {"regex": re.compile(r'gaia-build$'), "name": "Gaia Build Test"},
    {"regex": re.compile(r'gaia-unit-oop$'), "name": "Gaia Unit Test OOP"},
    {"regex": re.compile(r'gaia-unit$'), "name": "Gaia Unit Test"},
    {"regex": re.compile(r'gaia-(?:js-)?integration-oop'), "name": "Gaia JS Integration Test OOP"},
    {"regex": re.compile(r'gaia-(?:js-)?integration'), "name": "Gaia JS Integration Test"},
    {"regex": re.compile(r'gaia-ui-test-oop-accessibility'), "name": "Gaia Python Accessibility Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop-functional'), "name": "Gaia Python Functional Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop-unit'), "name": "Gaia Python Integration Unit Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-oop'), "name": "Gaia Python Integration Tests OOP"},
    {"regex": re.compile(r'gaia-ui-test-accessibility'), "name": "Gaia Python Accessibility Integration Tests"},
    {"regex": re.compile(r'gaia-ui-test-functional'), "name": "Gaia Python Functional Integration Tests"},
    {"regex": re.compile(r'gaia-ui-test-unit'), "name": "Gaia Python Integration Unit Tests"},
    {"regex": re.compile(r'gaia-ui-test'), "name": "Gaia Python Integration Tests"},
    {"regex": re.compile(r'linter$'), "name": "Linter Test"},
    {"regex": re.compile(r'marionette-webapi$'), "name": "Marionette WebAPI Tests"},
    {"regex": re.compile(r'marionette$'), "name": "Marionette Framework Unit Tests"},
    {"regex": re.compile(r'marionette-e10s$'), "name": "Marionette Framework Unit Tests e10s"},
    {"regex": re.compile(r'gtest$'), "name": "GTest Unit Tests"},
    {"regex": re.compile(r'androidx86-set'), "name": "Android x86 Test Set"},
    {"regex": re.compile(r'instrumentation-background'), "name": "Android Instrumentation Background"},
    {"regex": re.compile(r'instrumentation-browser'), "name": "Android Instrumentation Browser"},
    {"regex": re.compile(r'xpcshell'), "name": "XPCShell"},
    {"regex": re.compile(r'mozmill'), "name": "Mozmill"},
    {"regex": re.compile(r'luciddream'), "name": "Luciddream"},
    {"regex": re.compile(r'media-tests'), "name": "Media Tests MSE Video Playback"},
    {"regex": re.compile(r'media-youtube-tests'), "name": "Media Tests MSE YouTube Playback"},
    # ** Builds **
    # If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile(r'debug asan nightly'), "name": "AddressSanitizer Debug Nightly"},
    {"regex": re.compile(r'asan nightly'), "name": "AddressSanitizer Opt Nightly"},
    {"regex": re.compile(r'-sh-haz'), "name": "SpiderMonkey Hazard Analysis Build"},
    {"regex": re.compile(r'-haz'), "name": "Hazard Analysis Build"},
    {"regex": re.compile(r'xulrunner'), "name": "XULRunner Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512_eng.*_nightly'), "name": "Dolphin-512 Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_dolphin_eng.*_nightly'), "name": "Dolphin Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame-kk_eng.*_nightly'), "name": "Flame KitKat Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame_eng.*_nightly'), "name": "Flame Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_hamachi_eng.*_nightly'), "name": "Hamachi Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_helix_eng.*_nightly'), "name": "Helix Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_inari_eng.*_nightly'), "name": "Inari Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_leo_eng.*_nightly'), "name": "Leo Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-4_eng.*_nightly'), "name": "Nexus 4 Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-5-l_eng.*_nightly'), "name": "Nexus 5-L Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_tarako_eng.*_nightly'), "name": "Tarako Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_unagi_eng.*_nightly'), "name": "Unagi Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_eng.*_nightly'), "name": "Unknown B2G Device Image Nightly (Engineering)"},
    {"regex": re.compile(r'b2g.*_emulator.*_nightly'), "name": "B2G Emulator Image Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512.*_nightly'), "name": "Dolphin-512 Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin.*_nightly'), "name": "Dolphin Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_flame-kk.*_nightly'), "name": "Flame KitKat Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_flame.*_nightly'), "name": "Flame Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_hamachi.*_nightly'), "name": "Hamachi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_helix.*_nightly'), "name": "Helix Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_inari.*_nightly'), "name": "Inari Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_leo.*_nightly'), "name": "Leo Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nexus-4.*_nightly'), "name": "Nexus 4 Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nexus-5-l.*_nightly'), "name": "Nexus 5-L Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_tarako.*_nightly'), "name": "Tarako Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_unagi.*_nightly'), "name": "Unagi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_wasabi.*_nightly'), "name": "Wasabi Device Image Nightly"},
    {"regex": re.compile(r'b2g.*_nightly'), "name": "Unknown B2G Device Image Nightly"},
    {"regex": re.compile(r'(?:l10n|localizer) nightly'), "name": "L10n Nightly"},
    {"regex": re.compile(r'nightly'), "name": "Nightly"},
    {"regex": re.compile(r'b2g.*_dolphin-512_eng.*_(?:dep|periodic)'), "name": "Dolphin-512 Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_dolphin_eng.*_(?:dep|periodic)'), "name": "Dolphin Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame-kk_eng.*_(?:dep|periodic)'), "name": "Flame KitKat Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_flame_eng.*_(?:dep|periodic)'), "name": "Flame Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_hamachi_eng.*_(?:dep|periodic)'), "name": "Hamachi Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_helix_eng.*_(?:dep|periodic)'), "name": "Helix Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_inari_eng.*_(?:dep|periodic)'), "name": "Inari Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_leo_eng.*_(?:dep|periodic)'), "name": "Leo Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-4_eng.*_(?:dep|periodic)'), "name": "Nexus 4 Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_nexus-5-l_eng.*_(?:dep|periodic)'), "name": "Nexus 5-L Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_tarako_eng.*_(?:dep|periodic)'), "name": "Tarako Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_unagi_eng.*_(?:dep|periodic)'), "name": "Unagi Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_eng.*_(?:dep|periodic)'), "name": "Unknown B2G Device Image Build (Engineering)"},
    {"regex": re.compile(r'b2g.*_emulator.*_nonunified'), "name": "B2G Emulator Image Non-Unified Build"},
    {"regex": re.compile(r'b2g.*_emulator.*_(?:dep|periodic)'), "name": "B2G Emulator Image Build"},
    {"regex": re.compile(r'b2g.*_dolphin-512.*_(?:dep|periodic)'), "name": "Dolphin-512 Device Image Build"},
    {"regex": re.compile(r'b2g.*_dolphin.*_(?:dep|periodic)'), "name": "Dolphin Device Image Build"},
    {"regex": re.compile(r'b2g.*_flame-kk.*_(?:dep|periodic)'), "name": "Flame KitKat Device Image Build"},
    {"regex": re.compile(r'b2g.*_flame.*_(?:dep|periodic)'), "name": "Flame Device Image Build"},
    {"regex": re.compile(r'b2g.*_hamachi.*_(?:dep|periodic)'), "name": "Hamachi Device Image Build"},
    {"regex": re.compile(r'b2g.*_helix.*_(?:dep|periodic)'), "name": "Helix Device Image Build"},
    {"regex": re.compile(r'b2g.*_inari.*_(?:dep|periodic)'), "name": "Inari Device Image Build"},
    {"regex": re.compile(r'b2g.*_leo.*_(?:dep|periodic)'), "name": "Leo Device Image Build"},
    {"regex": re.compile(r'b2g.*_nexus-4.*_(?:dep|periodic)'), "name": "Nexus 4 Device Image Build"},
    {"regex": re.compile(r'b2g.*_nexus-5-l.*_(?:dep|periodic)'), "name": "Nexus 5-L Device Image Build"},
    {"regex": re.compile(r'b2g.*_tarako.*_(?:dep|periodic)'), "name": "Tarako Device Image Build"},
    {"regex": re.compile(r'b2g.*_unagi.*_(?:dep|periodic)'), "name": "Unagi Device Image Build"},
    {"regex": re.compile(r'b2g.*_wasabi.*_(?:dep|periodic)'), "name": "Wasabi Device Image Build"},
    {"regex": re.compile(r'b2g.*_(?:dep|periodic)'), "name": "Unknown B2G Device Image Build"},
    {"regex": re.compile(r'spidermonkey.*-arm-sim'), "name": "SpiderMonkey ARM Simulator Build"},
    {"regex": re.compile(r'spidermonkey.*-arm64-sim'), "name": "SpiderMonkey ARM64 Simulator Build"},
    {"regex": re.compile(r'spidermonkey.*-plain'), "name": "SpiderMonkey Plain Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-dtrace'), "name": "SpiderMonkey DTrace Build"},
    {"regex": re.compile(r'spidermonkey.*-warnaserr'), "name": "SpiderMonkey Fail-On-Warnings Build"},
    {"regex": re.compile(r'spidermonkey.*-exactroot'), "name": "SpiderMonkey Exact Rooting Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-generational'), "name": "SpiderMonkey GGC Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-compacting'), "name": "SpiderMonkey Compacting GC Shell Build"},
    {"regex": re.compile(r'spidermonkey.*-rootanalysis'), "name": "SpiderMonkey Root Analysis Build"},
    # If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile(r'debug asan build'), "name": "AddressSanitizer Debug Build"},
    {"regex": re.compile(r'asan build'), "name": "AddressSanitizer Opt Build"},
    {"regex": re.compile(r'non[-]?unified'), "name": "Non-Unified Build"},
    {"regex": re.compile(r'static analysis'), "name": "Static Checking Build"},
    {"regex": re.compile(r'valgrind'), "name": "Valgrind Build"},
    {"regex": re.compile(r'dxr'), "name": "DXR Index Build"},
    {"regex": re.compile(r'(build|dep|periodic)$'), "name": "Build"},
    {"regex": re.compile(r'[ _]l10n'), "name": "L10n Repack"},
    {"regex": re.compile(r'_partner_repacks'), "name": "Partner Repack"},
    {"regex": re.compile(r'_update_verify'), "name": "Update Verify"},
    {"regex": re.compile(r'periodic file update'), "name": "Periodic File Update"},
    # Release Promotion Related Jobs
    {"regex": re.compile(r'_uptake_monitoring'), "name": "Uptake Monitoring"},
    {"regex": re.compile(r'_chcksms'), "name": "Checksums Builder"},
    {"regex": re.compile(r'_bncr_sub'), "name": "Bouncer Submission"},
    {"regex": re.compile(r'_updates'), "name": "Release Promotion Updates"},
    {"regex": re.compile(r'_version_bump'), "name": "Version Bump"},
    {"regex": re.compile(r'_bouncer_aliases'), "name": "Bouncer Aliases"},
    {"regex": re.compile(r'_schedule_publishing_in_balrog'), "name": "Schedule Publishing in Balrog"},

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
    "L10n Repack": "L10n Repack",
    "Android x86 Test Set": "Android x86 Test Combos",
    "Mochitest": "Mochitest",
    "Mochitest Push": "Mochitest",
    "Mochitest Media": "Mochitest",
    "Mochitest GPU": "Mochitest",
    "Mochitest Clipboard": "Mochitest",
    "Mochitest Browser Chrome": "Mochitest",
    "Mochitest Browser Screenshots": "Mochitest",
    "Mochitest Chrome": "Mochitest",
    "Mochitest DevTools Browser Chrome": "Mochitest",
    "Mochitest WebGL": "Mochitest",
    "Mochitest Jetpack": "Mochitest",
    "Mochitest Metro Browser Chrome": "Mochitest",
    "Mochitest a11y": "Mochitest",
    "Mochitest Other": "Mochitest",
    "Webapprt Content": "Mochitest",
    "Webapprt Chrome": "Mochitest",
    "Robocop": "Mochitest",
    "Mochitest e10s": "Mochitest e10s",
    "Mochitest e10s Browser Chrome": "Mochitest e10s",
    "Mochitest e10s DevTools Browser Chrome": "Mochitest e10s",
    "Mochitest e10s Other": "Mochitest e10s",
    "Mochitest e10s Push": "Mochitest e10s",
    "Mochitest e10s GPU": "Mochitest e10s",
    "Mochitest e10s Clipboard": "Mochitest e10s",
    "Mochitest e10s Media": "Mochitest e10s",
    "Mochitest e10s WebGL": "Mochitest e10s",
    "Mochitest csb": "Mochitest csb",
    "Mochitest OOP": "Mochitest OOP",
    "Media Tests MSE Video Playback": "VideoPuppeteer",
    "Media Tests MSE YouTube Playback": "VideoPuppeteer",
    "Crashtest": "Reftest",
    "JSReftest": "Reftest",
    "Reftest": "Reftest",
    "Reftest GPU": "Reftest",
    "Reftest Sanity": "Reftest",
    "Reftest Unaccelerated": "Reftest",
    "Crashtest e10s": "Reftest e10s",
    "JSReftest e10s": "Reftest e10s",
    "Reftest e10s": "Reftest e10s",
    "Reftest GPU e10s": "Reftest e10s",
    "Reftest QR e10s": "Reftest e10s",
    "Reftest Unaccelerated e10s": "Reftest e10s",
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
    "SpiderMonkey ARM64 Simulator Build": "SpiderMonkey",
    "SpiderMonkey Plain Shell Build": "SpiderMonkey",
    "SpiderMonkey DTrace Build": "SpiderMonkey",
    "SpiderMonkey Fail-On-Warnings Build": "SpiderMonkey",
    "SpiderMonkey Exact Rooting Shell Build": "SpiderMonkey",
    "SpiderMonkey GGC Shell Build": "SpiderMonkey",
    "SpiderMonkey Compacting GC Shell Build": "SpiderMonkey",
    "SpiderMonkey Hazard Analysis Build": "SpiderMonkey",
    "SpiderMonkey Root Analysis Build": "SpiderMonkey",
    "W3C Web Platform Tests e10s": "W3C Web Platform Tests e10s",
    "W3C Web Platform Reftests e10s": "W3C Web Platform Tests e10s",
    "W3C Web Platform Tests": "W3C Web Platform Tests",
    "W3C Web Platform Reftests": "W3C Web Platform Tests",
    "Android Instrumentation Background": "Android Instrumentation Tests",
    "Android Instrumentation Browser": "Android Instrumentation Tests",
    "Talos svg": "Talos Performance",
    "Talos chrome e10s": "Talos Performance e10s",
    "Talos Stylo chrome e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled chrome e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling chrome e10s": "Talos Profiling Performance e10s",
    "Talos dromaeojs e10s": "Talos Performance e10s",
    "Talos Stylo dromaeojs e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled dromaeojs e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling dromaeojs e10s": "Talos Profiling Performance e10s",
    "Talos g1 e10s": "Talos Performance e10s",
    "Talos Stylo g1 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled g1 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling g1 e10s": "Talos Profiling Performance e10s",
    "Talos g2 e10s": "Talos Performance e10s",
    "Talos Stylo g2 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled g2 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling g2 e10s": "Talos Profiling Performance e10s",
    "Talos g3 e10s": "Talos Performance e10s",
    "Talos Stylo g3 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled g3 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling g3 e10s": "Talos Profiling Performance e10s",
    "Talos g4 e10s": "Talos Performance e10s",
    "Talos Stylo g4 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled g4 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling g4 e10s": "Talos Profiling Performance e10s",
    "Talos g5 e10s": "Talos Performance e10s",
    "Talos Stylo g5 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled g5 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling g5 e10s": "Talos Profiling Performance e10s",
    "Talos other e10s": "Talos Performance e10s",
    "Talos Stylo other e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled other e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling other e10s": "Talos Profiling Performance e10s",
    "Talos svg e10s": "Talos Performance e10s",
    "Talos Stylo svg e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled svg e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling svg e10s": "Talos Profiling Performance e10s",
    "Talos tp e10s": "Talos Performance e10s",
    "Talos Stylo tp e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled tp e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling tp e10s": "Talos Profiling Performance e10s",
    "Talos xperf e10s": "Talos Performance e10s",
    "Talos Stylo xperf e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled xperf e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling xperf e10s": "Talos Profiling Performance e10s",
    "Talos perf-reftest e10s": "Talos Performance e10s",
    "Talos Stylo perf-reftest e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled perf-reftest e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling perf-reftest e10s": "Talos Profiling Performance e10s",
    "Talos perf-reftest-singletons e10s": "Talos Performance e10s",
    "Talos Stylo perf-reftest-singletons e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled perf-reftest-singletons e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling perf-reftest-singletons e10s": "Talos Profiling Performance e10s",
    "Talos quantum-pageload e10s": "Talos Performance e10s",
    "Talos Stylo quantum-pageload-stylo e10s": "Talos Stylo Performance e10s",
    "Talos tp6 e10s": "Talos Performance e10s",
    "Talos Stylo tp6 e10s": "Talos Stylo Performance e10s",
    "Talos Stylo disabled tp6 e10s": "Talos Stylo disabled Performance e10s",
    "Talos Stylo sequential tp6 e10s": "Talos Stylo sequential Performance e10s",
    "Talos Profiling tp6 e10s": "Talos Profiling Performance e10s",
    "Talos speedometer e10s": "Talos Performance e10s",
    "Talos Stylo disabled speedometer e10s": "Talos Stylo disabled Performance e10s",
    "Talos Profiling speedometer e10s": "Talos Profiling Performance e10s",
    "Talos h1 e10s": "Talos Performance e10s",
    "Talos h2 e10s": "Talos Performance e10s",
    "Update Verify": "Release Promotion",
    "Uptake Monitoring": "Release Promotion",
    "Checksums Builder": "Release Promotion",
    "Bouncer Submission": "Release Promotion",
    "Release Promotion Updates": "Release Promotion",
    "Version Bump": "Release Promotion",
    "Bouncer Aliases": "Release Promotion",
    "Schedule Publishing in Balrog": "Schedule Publishing in Balrog",
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
    "SpiderMonkey ARM64 Simulator Build": "arm64",
    "SpiderMonkey Plain Shell Build": "p",
    "SpiderMonkey DTrace Build": "d",
    "SpiderMonkey Fail-On-Warnings Build": "e",
    "SpiderMonkey Exact Rooting Shell Build": "exr",
    "SpiderMonkey GGC Shell Build": "ggc",
    "SpiderMonkey Compacting GC Shell Build": "cgc",
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
    "Partner Repack": "Pr",
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
    "Mochitest Push": "p",
    "Mochitest Media": "mda",
    "Mochitest GPU": "gpu",
    "Mochitest Clipboard": "cl",
    "Mochitest Browser Chrome": "bc",
    "Mochitest Browser Screenshots": "ss",
    "Mochitest Chrome": "c",
    "Mochitest DevTools Browser Chrome": "dt",
    "Mochitest WebGL": "gl",
    "Mochitest Jetpack": "JP",
    "Mochitest Metro Browser Chrome": "mc",
    "Mochitest a11y": "a11y",
    "Mochitest Other": "oth",
    "Mochitest e10s": "M-e10s",
    "Mochitest e10s Browser Chrome": "bc",
    "Mochitest e10s DevTools Browser Chrome": "dt",
    "Mochitest e10s Other": "oth",
    "Mochitest e10s Push": "p",
    "Mochitest e10s Media": "mda",
    "Mochitest e10s GPU": "gpu",
    "Mochitest e10s Clipboard": "cl",
    "Mochitest e10s WebGL": "gl",
    "Mochitest csb": "M-csb",
    "Mochitest OOP": "M-oop",
    "Robocop": "rc",
    "Webapprt Content": "w",
    "Webapprt Chrome": "wc",
    "Crashtest": "C",
    "Crashtest e10s": "C",
    "JSReftest": "J",
    "JSReftest e10s": "J",
    "Reftest": "R",
    "Reftest e10s": "R-e10s",
    "Reftest GPU": "Rg",
    "Reftest GPU e10s": "Rg",
    "Reftest QR e10s": "R-qr",
    "Reftest Sanity OOP": "Rs-oop",
    "Reftest Sanity": "Rs",
    "Reftest Unaccelerated": "Ru",
    "Reftest Unaccelerated e10s": "Ru",
    "W3C Web Platform Tests e10s": "W-e10s",
    "W3C Web Platform Reftests e10s": "Wr-e10s",
    "W3C Web Platform Tests": "W",
    "W3C Web Platform Reftests": "Wr",
    "Android Instrumentation Tests": "I",
    "Android Instrumentation Background": "Ba",
    "Android Instrumentation Browser": "Br",

    # All other unit tests, sorted alphabetically by symbol.
    "CPP Unit Tests": "Cpp",
    "GTest Unit Tests": "GTest",
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
    "Luciddream": "Ld",
    "Linter Test": "Li",
    "Marionette Framework Unit Tests": "Mn",
    "Marionette Framework Unit Tests e10s": "Mn-e10s",
    "Marionette WebAPI Tests": "Mnw",
    "Android x86 Test Set": "S",
    "Android x86 Test Combos": "Sets",
    "VideoPuppeteer": "VP",
    "Media Tests MSE Video Playback": "b-m",
    "Media Tests MSE YouTube Playback": "b-y",
    "Updates": "Up",
    "Update Verify": "Uv",
    "Periodic File Update": "pfu",
    "XPCShell": "X",
    "Mozmill": "Z",

    # Display talos perf tests after correctness tests.
    "Talos Performance": "T",
    "Talos Performance e10s": "T-e10s",
    "Talos Stylo Performance e10s": "Ts-e10s",
    "Talos Stylo disabled Performance e10s": "Tsd-e10s",
    "Talos Stylo sequential Performance e10s": "Tss-e10s",
    "Talos Profiling Performance e10s": "T-P-e10s",
    "Talos chrome e10s": "c",
    "Talos Stylo chrome e10s": "c",
    "Talos Stylo disabled chrome e10s": "c",
    "Talos Profiling chrome e10s": "c",
    "Talos dromaeojs e10s": "d",
    "Talos Stylo dromaeojs e10s": "d",
    "Talos Stylo disabled dromaeojs e10s": "d",
    "Talos Profiling dromaeojs e10s": "d",
    "Talos g1 e10s": "g1",
    "Talos Stylo g1 e10s": "g1",
    "Talos Stylo disabled g1 e10s": "g1",
    "Talos Profiling g1 e10s": "g1",
    "Talos g2 e10s": "g2",
    "Talos Stylo g2 e10s": "g2",
    "Talos Stylo disabled g2 e10s": "g2",
    "Talos Profiling g2 e10s": "g2",
    "Talos g3 e10s": "g3",
    "Talos Stylo g3 e10s": "g3",
    "Talos Stylo disabled g3 e10s": "g3",
    "Talos Profiling g3 e10s": "g3",
    "Talos g4 e10s": "g4",
    "Talos Stylo g4 e10s": "g4",
    "Talos Stylo disabled g4 e10s": "g4",
    "Talos Profiling g4 e10s": "g4",
    "Talos g5 e10s": "g5",
    "Talos Stylo g5 e10s": "g5",
    "Talos Stylo disabled g5 e10s": "g5",
    "Talos Profiling g5 e10s": "g5",
    "Talos other e10s": "o",
    "Talos Stylo other e10s": "o",
    "Talos Stylo disabled other e10s": "o",
    "Talos Profiling other e10s": "o",
    "Talos svg": "s",
    "Talos svg e10s": "s",
    "Talos Stylo svg e10s": "s",
    "Talos Stylo disabled svg e10s": "s",
    "Talos Profiling svg e10s": "s",
    "Talos tp e10s": "tp",
    "Talos Stylo tp e10s": "tp",
    "Talos Stylo disabled tp e10s": "tp",
    "Talos Profiling tp e10s": "tp",
    "Talos tp nochrome": "tpn",
    "Talos xperf e10s": "x",
    "Talos Stylo xperf e10s": "x",
    "Talos Stylo disabled xperf e10s": "x",
    "Talos Profiling xperf e10s": "x",
    "Talos perf-reftest e10s": "p",
    "Talos Stylo perf-reftest e10s": "p",
    "Talos Stylo disabled perf-reftest e10s": "p",
    "Talos Profiling perf-reftest e10s": "p",
    "Talos perf-reftest-singletons e10s": "ps",
    "Talos Stylo perf-reftest-singletons e10s": "ps",
    "Talos Stylo disabled perf-reftest-singletons e10s": "ps",
    "Talos Profiling perf-reftest-singletons e10s": "ps",
    "Talos quantum-pageload e10s": "tp6",
    "Talos Stylo quantum-pageload-stylo e10s": "tp6",
    "Talos tp6 e10s": "tp6",
    "Talos Stylo tp6 e10s": "tp6",
    "Talos Stylo disabled tp6 e10s": "tp6",
    "Talos Stylo sequential tp6 e10s": "tp6",
    "Talos Profiling tp6 e10s": "tp6",
    "Talos speedometer e10s": "sp",
    "Talos Stylo disabled speedometer e10s": "sp",
    "Talos Profiling speedometer e10s": "sp",
    "Talos h1 e10s": "h1",
    "Talos h2 e10s": "h2",
    # Release Promotion Related Jobs
    "Release Promotion": "Release",
    "Uptake Monitoring": "up-m",
    "Checksums Builder": "CS",
    "Bouncer Submission": "BSub",
    "Bouncer Aliases": "Ba",
    "Version Bump": "Vb",
    "Release Promotion Updates": "Up",
    "Schedule Publishing in Balrog": "Spb",


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
    }
    for platform in PLATFORMS_BUILDERNAME:
        if platform['regex'].search(source_string):
            output.update(platform['attributes'])
            return output
    return output


def extract_build_type(source_string):
    output = 'opt'
    for build_type in BUILD_TYPE_BUILDERNAME:
        if build_type["regex"].search(source_string):
            output = build_type["type"]
            return output
    return output


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
            name = test_name["name"]
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
    if n and s in ["M", "M-e10s", "M-csb", "M-oop", "Gij", "Gij-oop", "W", "W-e10s"]:
        return n

    return "{0}{1}".format(s, n)


def get_symbols_and_platforms(buildername):
    """Return a dict with all the information we extract from the buildername."""
    platform_info = extract_platform_info(buildername)
    job_name_info = extract_name_info(buildername)

    job = {
        'job_type_name': job_name_info.get('name', ''),
        'job_type_symbol': job_name_info.get('job_symbol', ''),
        'job_group_name': job_name_info.get('group_name', ''),
        'job_group_symbol': job_name_info.get('group_symbol', ''),
        'ref_data_name': buildername,
        'build_platform': platform_info.get('os_platform', ''),
        'build_os': platform_info.get('os', ''),
        'build_architecture': platform_info.get('arch', ''),
        'build_system_type': 'buildbot',
        'machine_platform_architecture': platform_info.get('arch', ''),
        'machine_platform_os': platform_info.get('os', ''),
        'option_collection': {
            extract_build_type(buildername): True
        },
        'platform': platform_info.get('os_platform', ''),
    }
    return job
