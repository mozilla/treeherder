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
