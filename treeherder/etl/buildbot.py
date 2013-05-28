import re


####
#   The following variables were taken from util.py
#
#   PLATFORMS_BUILDERNAME, BUILD_TYPE_BUILDERNAME, JOB_TYPE_BUILDERNAME
#
#   http://mxr.mozilla.org/build/source/buildapi/buildapi/model/util.py
#
#   TODO: Once these attributes are available as build properties in the
#         pulse stream these structures can be removed.
####
PLATFORMS_BUILDERNAME = {

    'linux-mock': {
        'regexes': [
            re.compile('^b2g .+_armv7a.+', re.IGNORECASE),
            re.compile('^b2g linux32_gecko .+', re.IGNORECASE),
            re.compile('^b2g_((?!(test|talos)).)+$', re.IGNORECASE),
            re.compile('^Android (?!(?:Tegra|Armv6 Tegra|no-ionmonkey Tegra 250|4.0 Panda)).+'),
            re.compile('.*linux.*', re.IGNORECASE),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'gecko',
            'arch': 'ARMv7',
            'vm': False
        }
    },

    'fedora': {
        'regexes': [
            re.compile('^Rev3 Fedora 12 .+'),
            re.compile('jetpack-.*-fedora(?!64)'),
            re.compile('^b2g_.+(opt|debug) test.+', re.IGNORECASE)
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Fedora 12',
            'arch': 'x86',
            'vm': False
        }
    },

    'fedora64': {
        'regexes': [
            re.compile('Rev3 Fedora 12x64 .+'),
            re.compile('jetpack-.*-fedora64'),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Fedora 12',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'ubuntu32_vm': {
        'regexes': [
            re.compile('Ubuntu VM 12.04 (?!x64).+'),
            re.compile('jetpack-.*-ubuntu32(?:_vm)?'),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu 12.04',
            'arch': 'x86',
            'vm': True
        }
    },

    'ubuntu64_vm': {
        'regexes': [
            re.compile('Ubuntu VM 12.04 x64 .+'),
            re.compile('jetpack-.*-ubuntu64(?:_vm)?'),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu VM 12.04',
            'arch': 'x86_64',
            'vm': True
        }
    },

    'ubuntu32_hw': {
        'regexes': [
            re.compile('Ubuntu HW 12.04 (?!x64).+'),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu HW 12.04',
            'arch': 'x86',
            'vm': False
        }
    },

    'ubuntu64_hw': {
        'regexes': [
            re.compile('Ubuntu HW 12.04 x64 .+'),
        ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu HW 12.04',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'leopard': {
        'regexes': [
            re.compile('^OS X 10\.5.+'),
            re.compile('^Rev3 MacOSX Leopard 10\.5.+'),
            re.compile('.*macosx(?!64).*'),
            re.compile('jetpack-.*-leopard'),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.5',
            'arch': 'x86',
            'vm': False
        }
    },

    'snowleopard': {
        'regexes': [
            re.compile('^OS X 10\.6.+'),
            re.compile('^Rev3 MacOSX Snow Leopard 10\.6.+'),
            re.compile('.*macosx64.*'),
            re.compile('jetpack-.*-snowleopard'),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'snowleopard-r4': {
        'regexes': [
            re.compile('^Rev4 MacOSX Snow Leopard 10\.6.+'),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'lion': {
        'regexes': [
            re.compile('^OS X 10\.7.+'),
            re.compile('^Rev4 MacOSX Lion 10\.7.+'),
            re.compile('jetpack-.*-lion'),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'mountainlion': {
        'regexes': [
            re.compile('^Rev5 MacOSX Mountain Lion 10\.8+'),
            re.compile('jetpack-.*-mountainlion'),
        ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.8',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'xp': {
        'regexes': [
            re.compile('^Rev3 WINNT 5\.1 .+'),
            re.compile('jetpack-.*-xp'),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 5.1',
            'arch': 'x86',
            'vm': False
        }
    },

    'win2k3': {
        'regexes': [
            re.compile('^WINNT 5\.2 .+'),
            re.compile('.*win32.*'),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 5.2',
            'arch': 'x86',
            'vm': False
        }
    },

    'win64': {
        'regexes': [
            re.compile('^WINNT 6\.1 .+'),
            re.compile('.*win64.*'),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'win7': {
        'regexes': [
            re.compile('^Rev3 WINNT 6\.1 '),
            re.compile('jetpack-.*-win7'),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'Rev3 WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'win764': {
        'regexes': [
            re.compile('^Rev3 WINNT 6\.1 x64 .+'),
            re.compile('jetpack-.*-w764'),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'Rev3 WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'win8': {
        'regexes': [
            re.compile('.*WINNT 6\.2 '),
        ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 6.3',
            'arch': 'x86_64',
            'vm': False
        }
    },

    'tegra': {
        'regexes': [
            re.compile('^Android Tegra 250 .+'),
            re.compile('^Android Armv6 Tegra 250 .+'),
            re.compile('^Android no-ionmonkey Tegra 250 .+'),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': '2.2',
            'arch': 'ARMv7',
            'vm': False
        }
    },

    'panda-android': {
        'regexes': [
            re.compile('^Android 4.0 Panda .+'),
        ],

        'attributes': {
            'os': 'android',
            'os_platform': '4.0',
            'arch': 'x86',
            'vm': False
        }
    }
}

BUILD_TYPE_BUILDERNAME = {
    'opt': [
        re.compile('.+ opt .+'),
        re.compile('.+(?<!leak test) build'),
        re.compile('.+ talos .+'),          # all talos are made only for opt
        re.compile('.+ nightly$'),          # all nightly builds are opt
        re.compile('.+ xulrunner$'),        # nightly
        re.compile('.+ code coverage$'),    # nightly
    ],
    'debug': [
        re.compile('.+ debug .+'),
        re.compile('.+ leak test build'),
    ],
}

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
    output = {}
    for platform_name in PLATFORMS_BUILDERNAME:
        for regex in PLATFORMS_BUILDERNAME[platform_name]['regexes']:
            if regex.search(source_string):
                output['platform_name'] = platform_name
                output.update(
                    PLATFORMS_BUILDERNAME[platform_name]['attributes']
                )
                break
    return output


def extract_build_type(source_string):
    output = 'opt'
    for build_type in BUILD_TYPE_BUILDERNAME:
        for regex in BUILD_TYPE_BUILDERNAME[build_type]:
            if regex.search(source_string):
                output = build_type
                return output
    return output


def extract_job_type(source_string):
    for job_type in JOB_TYPE_BUILDERNAME:
        for regex in JOB_TYPE_BUILDERNAME[job_type]:
            if regex.search(source_string):
                return job_type

def extract_test_name(source_string):
    tokens = source_string.split()
    return tokens[-1]