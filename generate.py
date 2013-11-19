#!/home/vagrant/venv/bin/python

from treeherder.etl import buildbot
from pprint import pprint

bnames = [
"Android 2.2 Armv6 mozilla-inbound build",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test crashtest",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test jsreftest-1",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test mochitest-1",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test plain-reftest-1",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test robocop-1",
"Android 2.2 Armv6 Tegra mozilla-inbound opt test xpcshell",
"Android 2.2 Debug mozilla-inbound build",
"Android 2.2 mozilla-inbound build",
"Android 2.2 Tegra mozilla-inbound opt test crashtest",
"Android 2.2 Tegra mozilla-inbound talos remote-tcanvasmark",
"Android 4.0 Panda mozilla-inbound talos remote-tsvgx",
"Android 4.2 x86 mozilla-inbound build",
"b2g_emulator mozilla-inbound opt test reftest-1",
"b2g_mozilla-inbound_emulator_dep",
"b2g_mozilla-inbound_emulator-debug_dep",
"b2g_mozilla-inbound_emulator-jb_dep",
"b2g_mozilla-inbound_emulator-jb-debug_dep",
"b2g_mozilla-inbound_linux32_gecko build",
"b2g_mozilla-inbound_linux64_gecko build",
"b2g_mozilla-inbound_macosx64_gecko build",
"b2g_mozilla-inbound_unagi_dep",
"b2g_mozilla-inbound_win32_gecko build",
"b2g_ubuntu64_vm mozilla-inbound opt test gaia-ui-test",
"b2g_ubuntu64_vm mozilla-inbound opt test gaia-unit",
"b2g_ubuntu64_vm mozilla-inbound opt test mochitest-1",
"Linux mozilla-inbound build",
"Linux mozilla-inbound leak test build",
"Linux mozilla-inbound leak test spidermonkey_info-warnaserrdebug build",
"Linux mozilla-inbound pgo-build",
"Linux mozilla-inbound spidermonkey_info-warnaserr build",
"Linux x86-64 mozilla-inbound asan build",
"Linux x86-64 mozilla-inbound build",
"Linux x86-64 mozilla-inbound debug asan build",
"Linux x86-64 mozilla-inbound debug static analysis build",
"Linux x86-64 mozilla-inbound leak test build",
"Linux x86-64 mozilla-inbound leak test spidermonkey_tier_1-rootanalysis build",
"Linux x86-64 mozilla-inbound pgo-build",
"Linux x86-64 mozilla-inbound spidermonkey_info-warnaserr build",
"OS X 10.7 64-bit mozilla-inbound leak test build",
"OS X 10.7 mozilla-inbound build",
"Rev3 Fedora 12 mozilla-inbound debug test mochitest-browser-chrome",
"Rev3 Fedora 12x64 mozilla-inbound debug test mochitest-browser-chrome",
"Rev4 MacOSX Lion 10.7 mozilla-inbound debug test jetpack",
"Rev4 MacOSX Lion 10.7 mozilla-inbound debug test marionette",
"Rev4 MacOSX Lion 10.7 mozilla-inbound debug test reftest",
"Rev4 MacOSX Lion 10.7 mozilla-inbound talos dromaeojs",
"Rev4 MacOSX Snow Leopard 10.6 mozilla-inbound debug test crashtest",
"Rev5 MacOSX Mountain Lion 10.8 mozilla-inbound debug test crashtest",
"Ubuntu ASAN VM 12.04 x64 mozilla-inbound opt test crashtest",
"Ubuntu VM 12.04 x64 mozilla-inbound debug test marionette",
"Ubuntu HW 12.04 mozilla-inbound pgo talos chromez",
"Ubuntu HW 12.04 x64 mozilla-inbound pgo talos chromez",
"Ubuntu VM 12.04 mozilla-inbound debug test crashtest",
"Ubuntu VM 12.04 x64 mozilla-inbound debug test crashtest",
"Windows 7 32-bit mozilla-inbound debug test crashtest",
"Windows XP 32-bit mozilla-inbound debug test crashtest",
"WINNT 5.2 mozilla-inbound build",
"WINNT 6.2 mozilla-inbound debug test crashtest",
]

bnshort = [
    "Android 2.2 Armv6 Tegra mozilla-inbound opt test jsreftest-1",
    "Android 2.2 Armv6 Tegra mozilla-inbound opt test mochitest-1",
]

tests = []
for bn in bnshort:
    tests.append((bn, {
        "platform": buildbot.extract_platform_info(bn),
        "build_type": buildbot.extract_build_type(bn),
        "job_type": buildbot.extract_job_type(bn),
        "name": buildbot.extract_name_info(bn)
    }))

pprint(tests)