from treeherder.etl import buildbot
import pytest
import datetime
import time
import json

from django.conf import settings
from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.etl import buildbot, buildapi

slow = pytest.mark.slow

buildernames = [
 ('Android 2.2 Armv6 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test crashtest',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test jsreftest-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'JSReftest',
            'job_symbol': 'J1'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test mochitest-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Mochitest',
            'job_symbol': '1'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Tegra mozilla-inbound opt test mochitest-6',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Mochitest',
            'job_symbol': '6'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-2-2',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test plain-reftest-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Reftest',
            'job_symbol': 'R1'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test robocop-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Robocop',
            'job_symbol': 'rc1'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Armv6 Tegra mozilla-inbound opt test xpcshell',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'XPCShellTest',
            'job_symbol': 'X'},
   'platform': {'arch': 'armv6',
                'os': 'android',
                'os_platform': 'android-2-2-armv6',
                'vm': False}}),
 ('Android 2.2 Debug mozilla-inbound build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-2-2',
                'vm': False}}),
 ('Android 2.2 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-2-2',
                'vm': False}}),
 ('Android 2.2 Tegra mozilla-inbound opt test crashtest',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-2-2',
                'vm': False}}),
 ('Android 2.2 Tegra mozilla-inbound talos remote-tcanvasmark',
  {'build_type': 'opt',
   'job_type': 'talos',
   'name': {'group_name': 'Talos Performance',
            'group_symbol': 'T',
            'name': 'Talos canvasmark',
            'job_symbol': 'cm'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-2-2',
                'vm': False}}),
 ('Android 4.0 Panda mozilla-inbound talos remote-tsvgx',
  {'build_type': 'opt',
   'job_type': 'talos',
   'name': {'group_name': 'Talos Performance',
            'group_symbol': 'T',
            'name': 'Talos svg',
            'job_symbol': 's'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-4-0',
                'vm': False}}),
 ('Android 4.2 x86 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'android',
                'os_platform': 'android-4-2-x86',
                'vm': False}}),
 ('b2g_emulator mozilla-inbound opt test reftest-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Reftest',
            'job_symbol': 'R1'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-emu-ics',
                'vm': False}}),
 ('b2g_mozilla-inbound_emulator_dep',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'B2G Emulator Image Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-emu-ics',
                'vm': False}}),
 ('b2g_mozilla-inbound_emulator-debug_dep',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'B2G Emulator Image Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-emu-ics',
                'vm': False}}),
 ('b2g_mozilla-inbound_emulator-jb_dep',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'B2G Emulator Image Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-emu-jb',
                'vm': False}}),
 ('b2g_mozilla-inbound_emulator-jb-debug_dep',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'B2G Emulator Image Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-emu-jb',
                'vm': False}}),
 ('b2g_mozilla-inbound_linux32_gecko build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'b2g-linux32',
                'vm': False}}),
 ('b2g_mozilla-inbound_linux64_gecko build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'b2g-linux64',
                'vm': False}}),
 ('b2g_mozilla-inbound_macosx64_gecko build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'b2g-osx',
                'vm': False}}),
 ('b2g_mozilla-inbound_unagi_dep',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'Unagi Device Image',
            'group_symbol': 'Unagi',
            'name': 'Unagi Device Image Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'b2g',
                'os_platform': 'b2g-device-image',
                'vm': False}}),
 ('b2g_mozilla-inbound_win32_gecko build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'win',
                'os_platform': 'b2g-win32',
                'vm': False}}),
 ('b2g_ubuntu64_vm mozilla-inbound opt test gaia-ui-test',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Gaia UI Test',
            'job_symbol': 'Gu'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'b2g-linux64',
                'vm': True}}),
 ('b2g_ubuntu64_vm mozilla-inbound opt test gaia-unit',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Gaia Unit Test',
            'job_symbol': 'G'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'b2g-linux64',
                'vm': True}}),
 ('b2g_ubuntu64_vm mozilla-inbound opt test mochitest-1',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Mochitest',
            'job_symbol': '1'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'b2g-linux64',
                'vm': True}}),
 ('Linux mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Linux mozilla-inbound leak test build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Linux mozilla-inbound leak test spidermonkey_info-warnaserrdebug build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'SpiderMonkey',
            'group_symbol': 'SM',
            'name': 'SpiderMonkey --enable-sm-fail-on-warnings Build',
            'job_symbol': 'e'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Linux mozilla-inbound pgo-build',
  {'build_type': 'pgo',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Linux mozilla-inbound spidermonkey_info-warnaserr build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'SpiderMonkey',
            'group_symbol': 'SM',
            'name': 'SpiderMonkey --enable-sm-fail-on-warnings Build',
            'job_symbol': 'e'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound asan build',
  {'build_type': 'asan',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'AddressSanitizer Opt Build',
            'job_symbol': 'Bo'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound debug asan build',
  {'build_type': 'asan',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'AddressSanitizer Debug Build',
            'job_symbol': 'Bd'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound debug static analysis build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Static Checking Build',
            'job_symbol': 'S'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound leak test build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound leak test spidermonkey_tier_1-rootanalysis build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'SpiderMonkey',
            'group_symbol': 'SM',
            'name': 'SpiderMonkey --enable-root-analysis Build',
            'job_symbol': 'r'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound pgo-build',
  {'build_type': 'pgo',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Linux x86-64 mozilla-inbound spidermonkey_info-warnaserr build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'SpiderMonkey',
            'group_symbol': 'SM',
            'name': 'SpiderMonkey --enable-sm-fail-on-warnings Build',
            'job_symbol': 'e'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('OS X 10.7 64-bit mozilla-inbound leak test build',
  {'build_type': 'debug',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('OS X 10.7 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('Rev3 Fedora 12 mozilla-inbound debug test mochitest-browser-chrome',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Mochitest Browser Chrome',
            'job_symbol': 'bc'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Rev3 Fedora 12x64 mozilla-inbound debug test mochitest-browser-chrome',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Mochitest',
            'group_symbol': 'M',
            'name': 'Mochitest Browser Chrome',
            'job_symbol': 'bc'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Rev4 MacOSX Lion 10.7 mozilla-inbound debug test jetpack',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Jetpack SDK Test',
            'job_symbol': 'JP'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('Rev4 MacOSX Lion 10.7 mozilla-inbound debug test marionette',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Marionette Framework Unit Tests',
            'job_symbol': 'Mn'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('Rev4 MacOSX Lion 10.7 mozilla-inbound debug test reftest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Reftest',
            'job_symbol': 'R'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('Rev4 MacOSX Lion 10.7 mozilla-inbound talos dromaeojs',
  {'build_type': 'opt',
   'job_type': 'talos',
   'name': {'group_name': 'Talos Performance',
            'group_symbol': 'T',
            'name': 'Talos dromaeojs',
            'job_symbol': 'd'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-7',
                'vm': False}}),
 ('Rev4 MacOSX Snow Leopard 10.6 mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-6',
                'vm': False}}),
 ('Rev5 MacOSX Mountain Lion 10.8 mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86_64',
                'os': 'mac',
                'os_platform': 'osx-10-8',
                'vm': False}}),
 ('Ubuntu ASAN VM 12.04 x64 mozilla-inbound opt test crashtest',
  {'build_type': 'opt',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': True}}),
 ('Ubuntu VM 12.04 x64 mozilla-inbound debug test marionette',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Marionette Framework Unit Tests',
            'job_symbol': 'Mn'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': True}}),
 ('Ubuntu HW 12.04 mozilla-inbound pgo talos chromez',
  {'build_type': 'pgo',
   'job_type': 'talos',
   'name': {'group_name': 'Talos Performance',
            'group_symbol': 'T',
            'name': 'Talos chrome',
            'job_symbol': 'c'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': False}}),
 ('Ubuntu HW 12.04 x64 mozilla-inbound pgo talos chromez',
  {'build_type': 'pgo',
   'job_type': 'talos',
   'name': {'group_name': 'Talos Performance',
            'group_symbol': 'T',
            'name': 'Talos chrome',
            'job_symbol': 'c'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': False}}),
 ('Ubuntu VM 12.04 mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86',
                'os': 'linux',
                'os_platform': 'linux32',
                'vm': True}}),
 ('Ubuntu VM 12.04 x64 mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86_64',
                'os': 'linux',
                'os_platform': 'linux64',
                'vm': True}}),
 ('Windows 7 32-bit mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86',
                'os': 'win',
                'os_platform': 'windows7-32',
                'vm': False}}),
 ('Windows XP 32-bit mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86',
                'os': 'win',
                'os_platform': 'windowsxp',
                'vm': False}}),
 ('WINNT 5.2 mozilla-inbound build',
  {'build_type': 'opt',
   'job_type': 'build',
   'name': {'group_name': 'unknown',
            'group_symbol': '?',
            'name': 'Build',
            'job_symbol': 'B'},
   'platform': {'arch': 'x86',
                'os': 'win',
                'os_platform': 'windowsxp',
                'vm': False}}),
 ('WINNT 6.2 mozilla-inbound debug test crashtest',
  {'build_type': 'debug',
   'job_type': 'unittest',
   'name': {'group_name': 'Reftest',
            'group_symbol': 'R',
            'name': 'Crashtest',
            'job_symbol': 'C'},
   'platform': {'arch': 'x86',
                'os': 'win',
                'os_platform': 'windows8-32',
                'vm': False}})
]


@pytest.mark.parametrize(('buildername', 'exp_result'), buildernames)
def test_buildername_translation(buildername, exp_result):
    """
    test getting the right platform based on the buildername
    """

    assert buildbot.extract_platform_info(buildername) == exp_result["platform"]
    assert buildbot.extract_job_type(buildername) == exp_result["job_type"]
    assert buildbot.extract_build_type(buildername) == exp_result["build_type"]
    assert buildbot.extract_name_info(buildername) == exp_result["name"]

@pytest.mark.xfail
@pytest.mark.slowtest
def test_builds4h():

    jem = JsonExtractorMixin()
    extracted_content = jem.extract(settings.BUILDAPI_BUILDS4H_URL)

    branch_misses = {}
    objects_missing_buildernames = []
    platform_regex_misses = {}
    job_type_regex_misses = {}
    result_code_misses = {}
    request_id_misses = {}
    job_guid_misses = {}

    btfm = buildapi.Builds4hTransformerMixin()
    for build in extracted_content['builds']:

        # test for missing buildernames
        try:
            buildername = build['properties']['buildername']
        except KeyError:
            objects_missing_buildernames.append(json.dumps(build))
            continue

        # test for missing branch
        if not 'branch' in build['properties']:
            branch_misses[buildername]

        # test for missing result codes
        try:
            result_code = buildbot.RESULT_DICT[ build['result'] ]
        except KeyError:
            result_code_misses[result_code] = buildername

        # test for request_ids
        request_id = build['properties'].get('request_ids', '')
        if request_id == '':
            request_id = build['request_ids'][-1]
        else:
            request_id = request_id[-1]

        # test for request_times
        request_time_dict = build['properties'].get('request_times', '')
        request_time = ''
        if request_time_dict != '':
            request_time = request_time_dict[str(request_id)]
        else:
            request_time = build['requesttime']

        if not request_id or not request_time:
            request_id_misses[buildername] = json.dumps(build)

        # test for successful job_guid formulation
        job_guid = btfm.find_job_guid(build)
        if not job_guid:
            job_guid_misses[buildername] = 1

        # Execute regexes directly so we can find buildernames that fail

        # Match platforms
        platform_target = {}
        for platform in buildbot.PLATFORMS_BUILDERNAME:
            if platform['regex'].search(buildername):
                platform_target = platform['attributes']
                break
        if not platform_target:
            platform_regex_misses[buildername] = 1

        # Match job types
        job_type_target = ""
        for job_type in buildbot.JOB_TYPE_BUILDERNAME:
            for regex in buildbot.JOB_TYPE_BUILDERNAME[job_type]:
                if regex.search(buildername):
                    job_type_target = job_type
                    break
            if job_type_target:
                break
        if not job_type_target:
            job_type_regex_misses[buildername] = 1

    # generate builds4h report
    miss_count = process_output(
        objects_missing_buildernames,
        platform_regex_misses,
        job_type_regex_misses,
        result_code_misses,
        request_id_misses,
        job_guid_misses,
        branch_misses
        )

    assert miss_count == 0

def process_output(
    objects_missing_buildernames,
    platform_regex_misses,
    job_type_regex_misses,
    result_code_misses,
    request_id_misses,
    job_guid_misses,
    branch_misses):

    t_stamp = time.time()

    f = open('builds4h_misses_{0}.txt'.format(str(int(t_stamp))), 'w')

    readable_time = datetime.datetime.fromtimestamp(t_stamp).strftime('%Y-%m-%d %H:%M:%S')

    f.write("Builds4h Report Run On {0}\n".format(readable_time))
    f.write("------------------------------------\n")

    no_buildername_count = len(objects_missing_buildernames)
    if no_buildername_count > 0:
        f.write("{0} Objects Missing Buildernames\n".format(str(no_buildername_count)))
        f.write("------------------------------------\n")
        for obj in objects_missing_buildernames:
            f.write(obj)
            f.write("\n")
        f.write("------------------------------------\n")

    branch_miss_count = len(branch_misses.values())
    if branch_miss_count > 0:
        f.write("{0} Branch Misses\n".format(str(branch_miss_count)))
        f.write("------------------------------------\n")
        for buildername in sorted(branch_misses):
            f.write(buildername)
            f.write("\n")
        f.write("------------------------------------\n")

    platform_count = len(platform_regex_misses.values())
    if platform_count > 0:
        f.write("{0} Platform Regex Misses\n".format(str(platform_count)))
        f.write("------------------------------------\n")
        for buildername in sorted(platform_regex_misses):
            f.write(buildername)
            f.write("\n")
        f.write("------------------------------------\n")

    job_type_count = len(job_type_regex_misses.values())
    if job_type_count > 0:
        f.write("{0} Job Type Regex Misses\n".format(str(job_type_count)))
        f.write("------------------------------------\n")
        for buildername in sorted(job_type_regex_misses):
            f.write(buildername)
            f.write("\n")
        f.write("------------------------------------\n")

    result_code_miss_count = len(result_code_misses)
    if result_code_miss_count > 0:
        f.write("{0} Result Code Misses\n".format(str(result_code_miss_count)))
        f.write("------------------------------------\n")
        for data in sorted(result_code_misses):
            f.write("{0}: {1}".format(data['buildername'], data['result']))
            f.write("\n")
        f.write("------------------------------------\n")

    request_id_miss_count = len(request_id_misses.values())
    if request_id_miss_count > 0:
        f.write("{0} Request id/Request time Misses\n".format(str(request_id_miss_count)))
        f.write("------------------------------------\n")
        for buildername in sorted(request_id_misses):
            f.write(buildername)
            f.write("\n")
            f.write(request_id_misses[buildername])
            f.write("\n")
        f.write("------------------------------------\n")

    job_guid_miss_count = len(job_guid_misses)
    if job_guid_miss_count > 0:
        f.write("{0} Job Guid Misses\n".format(str(job_guid_miss_count)))
        f.write("------------------------------------\n")
        for buildername in sorted(job_guid_misses):
            f.write(buildername)
            f.write("\n")
        f.write("------------------------------------\n")

    f.close()

    return no_buildername_count + platform_count + job_type_count + \
                result_code_miss_count + request_id_miss_count
