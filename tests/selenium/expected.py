# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


class window_with_title(object):
    """An expectation for checking that a window exists with the specified title.

    :returns: window handle if window exists, False otherwise
    """

    def __init__(self, title):
        self.title = title

    def __call__(self, selenium):
        for w in selenium.window_handles:
            selenium.switch_to.window(w)
            if self.title in selenium.title:
                return w
