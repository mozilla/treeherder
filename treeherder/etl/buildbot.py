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
        'regexes': [
            re.compile('^b2g.*_(?:linux|ubuntu)64', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('(?:linux|fedora|ubuntu).*64', re.IGNORECASE),
            re.compile('dxr', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'linux64',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('^b2g.*_(?:linux|ubuntu)32', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'b2g-linux32',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('linux|fedora|ubuntu', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'linux32',
            'arch': 'x86',
        }
    },

    #// ** OS X **

    {
        'regexes': [
            re.compile('^b2g.*_macosx64', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'b2g-osx',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('mountain[ ]?lion', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-8',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('OS X 10\.7|lion|macosx64', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-7',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('snow[ ]?leopard', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'osx-10-6',
            'arch': 'x86_64',
        }
    },

    #// ** Windows **

    {
        'regexes': [
            re.compile('^b2g.*_win32', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'b2g-win32',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('WINNT 5|-xp-|Windows XP 32-bit', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'windowsxp',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('WINNT 6\.1 x(?:86-)?64|win64', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'windows2012-64',
            'arch': 'x86_64',
        }
    },
    {
        'regexes': [
            re.compile('WINNT 6\.1|win7|Windows 7 32-bit', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'windows7-32',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('WINNT 6\.2|win8', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'windows8-32',
            'arch': 'x86',
        }
    },

    #// ** Android **

    {
        'regexes': [
            re.compile('android 4\.2 x86', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-2-x86',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('android 4\.0', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': 'android-4-0',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('android 2\.2 no-ionmonkey', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2-noion',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('android 2\.2 armv6', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2-armv6',
            'arch': 'armv6',
        }
    },
    {
        'regexes': [
            re.compile('android 2\.2', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': 'android-2-2',
            'arch': 'x86',
        }
    },


    {
        'regexes': [
            re.compile('b2g.*_emulator-jb', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-jb',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('b2g.*_emulator(?:-ics)?', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'b2g',
            'os_platform': 'b2g-emu-ics',
            'arch': 'x86',
        }
    },
    {
        'regexes': [
            re.compile('b2g.*_(?:dep|nightly)$', re.IGNORECASE),
        ],

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
        'regexes': [
            re.compile('.+ pgo(?:[ ]|-).+'),
        ]
    },
    {
        'type': 'asan',
        'regexes': [
            re.compile('.+ asan .+'),
        ]
    },
    {
        'type': 'debug',
        'regexes': [
            re.compile('(?:debug|leak)', re.IGNORECASE),
        ]
    }
    # defaults to "opt" if not found
]

JOB_TYPE_BUILDERNAME = {
    'build': [
        re.compile('.+ build'),
        re.compile('.+(?<!l10n) nightly$'),     # all 'nightly'-s are builds
        re.compile('.+ xulrunner$'),            # nightly
        re.compile('.+ code coverage$'),        # nightly
    ],
    'unittest': [re.compile('.+(?<!leak) test .+')],
    'talos': [re.compile('.+ talos .+')],
    'repack': [re.compile('.+ l10n .+')],
}


def extract_platform_info(source_string):
    output = {
        'os': 'unknown',
        'os_platform': source_string[:24],
        'arch': 'unknown',
        'vm': extract_vm_status(source_string)
    }
    for platform in PLATFORMS_BUILDERNAME:
        for regex in platform['regexes']:
            if regex.search(source_string):
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
        for regex in build_type["regexes"]:
            if regex.search(source_string, re.IGNORECASE):
                output = build_type["type"]
                return output
    return output


def extract_job_type(source_string):
    job_type = 'build'
    for job_type in JOB_TYPE_BUILDERNAME:
        for regex in JOB_TYPE_BUILDERNAME[job_type]:
            if regex.search(source_string):
                return job_type
    return job_type


def extract_test_name(source_string):
    tokens = source_string.split()
    return tokens[-1]
