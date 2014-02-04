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
        'regex': re.compile('(?:linux|fedora|ubuntu).*64|dxr', re.IGNORECASE),
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
        'regex': re.compile('linux|fedora|ubuntu', re.IGNORECASE),
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
        'regex': re.compile('Mavericks', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-9',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('mountain[ ]?lion', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-8',
            'arch': 'x86_64',
        }
    },
    {
        'regex': re.compile('OS X 10\.7|lion|macosx64', re.IGNORECASE),
        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-7',
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
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('android 2\.2 no-ionmonkey', re.IGNORECASE),
        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2-noion',
            'arch': 'x86',
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
            'arch': 'x86',
        }
    },

    #// ** B2G **

    {
        'regex': re.compile('b2g.*_emulator-jb', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-jb',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('b2g.*_emulator(?:-ics)?', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-ics',
            'arch': 'x86',
        }
    },
    {
        'regex': re.compile('b2g.*_(?:dep|nightly)$', re.IGNORECASE),
        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-device-image',
            'arch': 'x86',
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

TEST_NAME_BUILDERNAME = [
        #// ** Talos **
    {"regex": re.compile('talos remote-tcanvasmark$'), "desc": "Talos canvasmark"},
    {"regex": re.compile('talos chrome[z]?$'), "desc": "Talos chrome"},
    {"regex": re.compile('talos dromaeojs$'), "desc": "Talos dromaeojs"},
    {"regex": re.compile('talos dromaeojs-metro$'), "desc": "Talos dromaeojs Metro"},
    {"regex": re.compile('talos other$'), "desc": "Talos other"},
    {"regex": re.compile('talos other-metro$'), "desc": "Talos other Metro"},
    {"regex": re.compile('talos dirtypaint$'), "desc": "Talos paint"},
    {"regex": re.compile('talos remote-trobocheck2$'), "desc": "Talos robocheck2"},
    {"regex": re.compile('talos remote-trobopan$'), "desc": "Talos robopan"},
    {"regex": re.compile('talos remote-troboprovider$'), "desc": "Talos roboprovider"},
    {"regex": re.compile('talos (?:remote-t)?svg[rx]?$'), "desc": "Talos svg"},
    {"regex": re.compile('talos (?:remote-t)?svg[rx]?-metro$'), "desc": "Talos svg Metro"},
    {"regex": re.compile('talos remote-tp4m_nochrome$'), "desc": "Talos tp nochrome"},
    {"regex": re.compile('talos (?:remote-)?tp5o-metro$'), "desc": "Talos tp Metro"},
    {"regex": re.compile('talos (?:remote-)?tp'), "desc": "Talos tp"},
    {"regex": re.compile('talos remote-tspaint$'), "desc": "Talos tspaint"},
    {"regex": re.compile('talos remote-ts$'), "desc": "Talos ts"},
    {"regex": re.compile('talos xperf$'), "desc": "Talos xperf"},
        #// ** Builds **
        #// If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile('debug asan nightly'), "desc": "AddressSanitizer Debug Nightly"},
    {"regex": re.compile('asan nightly'), "desc": "AddressSanitizer Opt Nightly"},
    {"regex": re.compile('-br-haz'), "desc": "Static Rooting Hazard Analysis, Full Browser"},
    {"regex": re.compile('-sh-haz'), "desc": "Static Rooting Hazard Analysis, JS Shell"},
    {"regex": re.compile('xulrunner'), "desc": "XULRunner Nightly"},
    {"regex": re.compile('b2g.*_hamachi_eng_nightly'), "desc": "Hamachi Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_helix_eng_nightly'), "desc": "Helix Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_inari_eng_nightly'), "desc": "Inari Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_leo_eng_nightly'), "desc": "Leo Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_unagi_eng_nightly'), "desc": "Unagi Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_eng_nightly'), "desc": "Unknown B2G Device Image Nightly (Engineering)"},
    {"regex": re.compile('b2g.*_buri-limited-memory_nightly'), "desc": "Buri Limited Memory Device Image Nightly"},
    {"regex": re.compile('b2g.*_hamachi_nightly'), "desc": "Hamachi Device Image Nightly"},
    {"regex": re.compile('b2g.*_helix_nightly'), "desc": "Helix Device Image Nightly"},
    {"regex": re.compile('b2g.*_inari_nightly'), "desc": "Inari Device Image Nightly"},
    {"regex": re.compile('b2g.*_leo_nightly'), "desc": "Leo Device Image Nightly"},
    {"regex": re.compile('b2g.*_nexus-4_nightly'), "desc": "Nexus 4 Device Image Nightly"},
    {"regex": re.compile('b2g.*_unagi_nightly'), "desc": "Unagi Device Image Nightly"},
    {"regex": re.compile('b2g.*_nightly'), "desc": "Unknown B2G Device Image Nightly"},
    {"regex": re.compile('(?:l10n|localizer) nightly'), "desc": "L10n Nightly"},
    {"regex": re.compile('nightly'), "desc": "Nightly"},
    {"regex": re.compile('b2g.*_hamachi_eng_dep'), "desc": "Hamachi Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_helix_eng_dep'), "desc": "Helix Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_inari_eng_dep'), "desc": "Inari Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_leo_eng_dep'), "desc": "Leo Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_unagi_eng_dep'), "desc": "Unagi Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_eng_dep'), "desc": "Unknown B2G Device Image Build (Engineering)"},
    {"regex": re.compile('b2g.*_emulator.*_dep'), "desc": "B2G Emulator Image Build"},
    {"regex": re.compile('b2g.*_buri-limited-memory_dep'), "desc": "Buri Limited Memory Device Image Build"},
    {"regex": re.compile('b2g.*_hamachi_dep'), "desc": "Hamachi Device Image Build"},
    {"regex": re.compile('b2g.*_helix_dep'), "desc": "Helix Device Image Build"},
    {"regex": re.compile('b2g.*_inari_dep'), "desc": "Inari Device Image Build"},
    {"regex": re.compile('b2g.*_leo_dep'), "desc": "Leo Device Image Build"},
    {"regex": re.compile('b2g.*_nexus-4_dep'), "desc": "Nexus 4 Device Image Build"},
    {"regex": re.compile('b2g.*_unagi_dep'), "desc": "Unagi Device Image Build"},
    {"regex": re.compile('b2g.*_wasabi_dep'), "desc": "Wasabi Device Image Build"},
    {"regex": re.compile('b2g.*_dep'), "desc": "Unknown B2G Device Image Build"},
    {"regex": re.compile('spidermonkey.*-dtrace'), "desc": "SpiderMonkey DTrace Build"},
    {"regex": re.compile('spidermonkey.*-rootanalysis'), "desc": "SpiderMonkey --enable-root-analysis Build"},
    {"regex": re.compile('spidermonkey.*-generational'), "desc": "SpiderMonkey GGC Shell Build"},
    {"regex": re.compile('spidermonkey.*-exactroot'), "desc": "SpiderMonkey Exact Rooting Shell Build"},
    {"regex": re.compile('spidermonkey.*-warnaserr'), "desc": "SpiderMonkey --enable-sm-fail-on-warnings Build"},
        #// If we start doing debug ASan tests, please kill these special build types
    {"regex": re.compile('debug asan build'), "desc": "AddressSanitizer Debug Build"},
    {"regex": re.compile('asan build'), "desc": "AddressSanitizer Opt Build"},
    {"regex": re.compile('non-unified'), "desc": "Non-Unified Build"},
    {"regex": re.compile('static analysis'), "desc": "Static Checking Build"},
    {"regex": re.compile('valgrind'), "desc": "Valgrind Nightly"},
    {"regex": re.compile('dxr'), "desc": "DXR Index Build"},
    {"regex": re.compile('build$'), "desc": "Build"},
        #// ** Unit tests **
    {"regex": re.compile('mochitest-other'), "desc": "Mochitest Other"},
    {"regex": re.compile('mochitest-metro-chrome'), "desc": "Mochitest Metro Browser Chrome"},
    {"regex": re.compile('mochitest-browser-chrome'), "desc": "Mochitest Browser Chrome"},
    {"regex": re.compile('mochitest-gl'), "desc": "Mochitest WebGL"},
    {"regex": re.compile('mochitest'), "desc": "Mochitest"},
    {"regex": re.compile('robocop'), "desc": "Robocop"},
    {"regex": re.compile('crashtest-ipc'), "desc": "Crashtest-IPC"},
    {"regex": re.compile('crashtest'), "desc": "Crashtest"},
    {"regex": re.compile('jsreftest'), "desc": "JSReftest"},
    {"regex": re.compile('reftest-no-accel'), "desc": "Reftest Unaccelerated"},
    {"regex": re.compile('reftest-ipc'), "desc": "Reftest-IPC"},
    {"regex": re.compile('reftest'), "desc": "Reftest"},
    {"regex": re.compile('cppunit'), "desc": "CPP Unit Tests"},
    {"regex": re.compile('jittest'), "desc": "JIT Tests"},
    {"regex": re.compile('xpcshell'), "desc": "XPCShellTest"},
    {"regex": re.compile('marionette-webapi'), "desc": "Marionette WebAPI Tests"},
    {"regex": re.compile('marionette'), "desc": "Marionette Framework Unit Tests"},
    {"regex": re.compile('gaia-integration'), "desc": "Gaia Integration Test"},
    {"regex": re.compile('gaia-ui-test'), "desc": "Gaia UI Test"},
    {"regex": re.compile('gaia-unit'), "desc": "Gaia Unit Test"},
    {"regex": re.compile('jetpack'), "desc": "Jetpack SDK Test"},
    {"regex": re.compile('mozmill'), "desc": "Mozmill"},
    {"regex": re.compile('androidx86-set'), "desc": "Android x86 Test Set"},
]

# map test names to group names as "<testname>": "<groupname>"
# when updating, please take care to ensure the ``testname`` AND the
# ``groupname`` exist in the ``SYMBOLS`` dict as well.
GROUP_NAMES = {
    "Hamachi Device Image Build": "Buri/Hamachi Device Image",
    "Hamachi Device Image Build (Engineering)": "Buri/Hamachi Device Image",
    "Buri Limited Memory Device Image Build": "Buri/Hamachi Device Image",
    "Hamachi Device Image Nightly": "Buri/Hamachi Device Image",
    "Hamachi Device Image Nightly (Engineering)": "Buri/Hamachi Device Image",
    "Buri Limited Memory Device Image Nightly": "Buri/Hamachi Device Image",
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
    "Nexus 4 Device Image Nightly": "Nexus 4 Device Image",
    "Unagi Device Image Build": "Unagi Device Image",
    "Unagi Device Image Build (Engineering)": "Unagi Device Image",
    "Unagi Device Image Nightly": "Unagi Device Image",
    "Unagi Device Image Nightly (Engineering)": "Unagi Device Image",
    "Wasabi Device Image Build": "Wasabi Device Image",
    "Unknown B2G Device Image Build": "Unknown Device Image",
    "Unknown B2G Device Image Build (Engineering)": "Unknown Device Image",
    "Unknown B2G Device Image Nightly": "Unknown Device Image",
    "Unknown B2G Device Image Nightly (Engineering)": "Unknown Device Image",
    "L10n Nightly": "L10n Repack",
    "Android x86 Test Set": "Android x86 Test Combos",
    "Mochitest": "Mochitest",
    "Mochitest WebGL": "Mochitest",
    "Mochitest Browser Chrome": "Mochitest",
    "Mochitest Metro Browser Chrome": "Mochitest",
    "Mochitest Other": "Mochitest",
    "Robocop": "Mochitest",
    "Crashtest": "Reftest",
    "Crashtest-IPC": "Reftest",
    "Reftest": "Reftest",
    "Reftest Unaccelerated": "Reftest",
    "Reftest-IPC": "Reftest",
    "JSReftest": "Reftest",
    "SpiderMonkey DTrace Build": "SpiderMonkey",
    "SpiderMonkey --enable-root-analysis Build": "SpiderMonkey",
    "SpiderMonkey --enable-sm-fail-on-warnings Build": "SpiderMonkey",
    "SpiderMonkey GGC Shell Build": "SpiderMonkey",
    "SpiderMonkey Exact Rooting Shell Build": "SpiderMonkey",
    "Static Rooting Hazard Analysis, JS Shell": "SpiderMonkey",
    "Static Rooting Hazard Analysis, Full Browser": "SpiderMonkey",
    "Talos Performance": "Talos Performance",
    "Talos canvasmark": "Talos Performance",
    "Talos chrome": "Talos Performance",
    "Talos dromaeojs": "Talos Performance",
    "Talos dromaeojs Metro": "Talos Performance",
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
SYMBOLS = {
    # builds

    # // ** Dep Builds **
    "Build" : "B",
    "Non-Unified Build": "Bn",
    "Static Checking Build" : "S",
    "SpiderMonkey" : "SM",
    "SpiderMonkey DTrace Build" : "d",
    "SpiderMonkey --enable-root-analysis Build" : "r",
    "SpiderMonkey --enable-sm-fail-on-warnings Build" : "e",
    "SpiderMonkey GGC Shell Build" : "ggc",
    "SpiderMonkey Exact Rooting Shell Build" : "exr",
    "Static Rooting Hazard Analysis, JS Shell" : "Hs",
    "Static Rooting Hazard Analysis, Full Browser" : "Hf",
    # // ** Nightly Builds **
    "Nightly" : "N",
    "DXR Index Build" : "Dxr",
    "Valgrind Nightly": "V",
    "XULRunner Nightly" : "Xr",
    # // ** Special Builds **
    # // If we start doing debug ASan tests, please
    # // kill these special build types
    "AddressSanitizer Opt Build": "Bo",
    "AddressSanitizer Debug Build": "Bd",
    "AddressSanitizer Opt Nightly": "No",
    "AddressSanitizer Debug Nightly": "Nd",
    # // L10n nightlies are grouped above so they appear as N1, N2, etc.
    "L10n Nightly" : "N",
    "L10n Repack": "L10n",
    "B2G Emulator Image Build": "B",
    # // B2G device image builds (grouped by device in the UI)
    "Buri/Hamachi Device Image": "Buri/Hamachi",
    "Hamachi Device Image Build": "B",
    "Hamachi Device Image Build (Engineering)": "Be",
    "Buri Limited Memory Device Image Build": "Bm",
    "Hamachi Device Image Nightly": "N",
    "Hamachi Device Image Nightly (Engineering)": "Ne",
    "Buri Limited Memory Device Image Nightly": "Nm",
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
    "Nexus 4 Device Image Nightly": "N",
    "Unagi Device Image": "Unagi",
    "Unagi Device Image Build": "B",
    "Unagi Device Image Build (Engineering)": "Be",
    "Unagi Device Image Nightly": "N",
    "Unagi Device Image Nightly (Engineering)": "Ne",
    "Wasabi Device Image": "Wasabi",
    "Wasabi Device Image Build": "B",
    "Unknown Device Image": "Unknown",
    "Unknown B2G Device Image Build": "B",
    "Unknown B2G Device Image Build (Engineering)": "Be",
    "Unknown B2G Device Image Nightly": "N",
    "Unknown B2G Device Image Nightly (Engineering)": "Ne",
    # tests

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
    "Talos dromaeojs Metro" : "d-m",
    "Talos svg" : "s",
    "Talos svg Metro" : "s-m",
    "Talos tp" : "tp",
    "Talos tp Metro" : "tp-m",
    "Talos tp nochrome" : "tpn",
    "Talos other" : "o",
    "Talos other Metro" : "o-m",
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
    "unknown": "?",
}

NUMBER_RE = re.compile(".*(?:mochitest(?:-debug)?|reftest|crashtest|robocop|androidx86-set|browser-chrome)\-([0-9]+)", re.IGNORECASE)


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

    # Mochitests are the only ones that display only as a number, no letters
    if s == "M":
        s = ""

    n = ""
    nummatch = NUMBER_RE.match(bn)
    if nummatch:
        n = nummatch.group(1)
    return "{0}{1}".format(s, n)
