#!/bin/bash -ex

source ./venv_modules/bin/activate
firefox-ui-functional tests/test_tp.py --binary firefox/FirefoxNightly.app/Contents/MacOS/firefox-bin -v
