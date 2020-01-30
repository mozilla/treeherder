# repos that SETA supports
SETA_PROJECTS = [
    'autoland',
    'try'
]

# for taskcluster, only jobs that start with any of these names
# will be supported i.e. may be optimized out by SETA
SETA_SUPPORTED_TC_JOBTYPES = [
    'test-',
    'desktop-test',
    'android-test,'
    'build-android-x86-fuzzing',
    'build-android-x86_64-asan-fuzzing',
    'build-linux64-asan-fuzzing-ccov',
    'build-linux64-asan-fuzzing',
    'build-linux64-fuzzing-ccov',
    'build-linux64-fuzzing',
    'build-linux64-tsan-fuzzing',
    'build-macosx64-asan-fuzzing',
    'build-macosx64-fuzzing',
    'build-win64-asan-fuzzing',
    'build-win64-fuzzing',
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
    'Opt',
    'Debug',
    'Dbg',
    '(opt)'
    'PGO Opt',
    'Valgrind Opt',
    'Artifact Opt',
    '(debug)'
]

# SETA job priority values
SETA_HIGH_VALUE_PRIORITY = 1
SETA_LOW_VALUE_PRIORITY = 5

# analyze_failures retrieves jobs marked 'fixed by commit' for these repos
SETA_FIXED_BY_COMMIT_REPOS = [
    'autoland',
    'mozilla-central',
    'mozilla-inbound'
]

# analyze_failures retrieves jobs marked 'fixed by commit' for the past N days
SETA_FIXED_BY_COMMIT_DAYS = 90

# when retrieving taskcluster runnable jobs, and processing
# them, cache the resulting reference data names map for N seconds; this
# helps reduce the number of API calls when getting job priorities
SETA_REF_DATA_NAMES_CACHE_TIMEOUT = 3600
