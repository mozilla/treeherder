# repos that SETA supports
SETA_PROJECTS = [
    'mozilla-inbound',
    'autoland'
]

# for taskcluster, only jobs that start with any of these names
# will be supported i.e. may be optimized out by SETA
SETA_SUPPORTED_TC_JOBTYPES = [
    'test-',
    'desktop-test',
    'android-test'
]

# platforms listed here will not be supported by SETA
# i.e. these will never be optimized out by SETA
SETA_UNSUPPORTED_PLATFORMS = [
    'android-4-2-armv7-api15',
    'android-4-4-armv7-api15',
    'android-5-0-armv8-api15',
    'android-5-1-armv7-api15',
    'android-6-0-armv8-api15',
    'osx-10-7',  # Build
    'osx-10-9',
    'osx-10-11',
    'other',
    'taskcluster-images',
    'windows7-64',   # We don't test 64-bit builds on Windows 7 test infra
    'windows8-32',  # We don't test 32-bit builds on Windows 8 test infra
    'Win 6.3.9600 x86_64',
    'linux64-stylo',
    'windowsxp'
]

# testtypes listed here will not be supported by SETA
# i.e. these will never be optimized out by SETA
SETA_UNSUPPORTED_TESTTYPES = [
    'dep',
    'nightly',
    'non-unified',
    'valgrind',
    'build',
    'Opt',
    'Debug',
    'Dbg',
    '(opt)'
    'PGO Opt',
    'Valgrind Opt',
    'Artifact Opt',
    '(debug)'
]
