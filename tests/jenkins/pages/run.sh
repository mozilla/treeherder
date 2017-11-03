#!/bin/bash -ex

# shellcheck source=/dev/null
source ./venv_modules/bin/activate
firefox-ui-functional tests/test_tp.py --binary firefox/FirefoxNightly.app/Contents/MacOS/firefox-bin -v
