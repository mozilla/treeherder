from django_browserid import helpers
from django_browserid.tests import TestCase


class BrowserIDJSTests(TestCase):
    def test_basic(self):
        output = helpers.browserid_js()
        self.assertHTMLEqual(output, """
            <script type="text/javascript" src="https://login.persona.org/include.js"></script>
            <script type="text/javascript" src="static/browserid/browserid.js"></script>
        """)

    def test_no_shim(self):
        output = helpers.browserid_js(include_shim=False)
        self.assertHTMLEqual(output, """
            <script type="text/javascript" src="static/browserid/browserid.js"></script>
        """)

    def test_custom_shim(self):
        with self.settings(BROWSERID_SHIM='http://example.com/test.js'):
            output = helpers.browserid_js()
        self.assertHTMLEqual(output, """
            <script type="text/javascript" src="http://example.com/test.js"></script>
            <script type="text/javascript" src="static/browserid/browserid.js"></script>
        """)


class BrowserIDCSSTests(TestCase):
    def test_basic(self):
        output = helpers.browserid_css()
        self.assertHTMLEqual(output, """
            <link rel="stylesheet" href="static/browserid/persona-buttons.css" />
        """)


class BrowserIDButtonTests(TestCase):
    def test_basic(self):
        button = helpers.browserid_button(text='asdf', next='1234', link_class='fake-button',
                                          href="/test", attrs={'target': '_blank'})
        self.assertHTMLEqual(button, """
            <a href="/test" class="fake-button" data-next="1234" target="_blank">
                <span>asdf</span>
            </a>
        """)

    def test_json_attrs(self):
        button = helpers.browserid_button(text='qwer', next='5678', link_class='fake-button',
                                          attrs='{"target": "_blank"}')
        self.assertHTMLEqual(button, """
            <a href="#" class="fake-button" data-next="5678" target="_blank">
                <span>qwer</span>
            </a>
        """)


class BrowserIDLoginTests(TestCase):
    def test_login_class(self):
        with self.settings(LOGIN_REDIRECT_URL='/'):
            button = helpers.browserid_login(link_class='go button')
        self.assertHTMLEqual(button, """
            <a href="#" class="go button" data-next="/">
                <span>Sign in</span>
            </a>
        """)

    def test_default_class(self):
        # If no class is provided, it should default to
        # 'browserid-login persona-button'
        with self.settings(LOGIN_REDIRECT_URL='/'):
            button = helpers.browserid_login()
        self.assertHTMLEqual(button, """
            <a href="#" class="browserid-login persona-button" data-next="/">
                <span>Sign in</span>
            </a>
        """)

    def test_color_class(self):
        with self.settings(LOGIN_REDIRECT_URL='/'):
            button = helpers.browserid_login(color='dark')
        self.assertHTMLEqual(button, """
            <a href="#" class="browserid-login persona-button dark" data-next="/">
                <span>Sign in</span>
            </a>
        """)

    def test_color_custom_class(self):
        # If using a color and a custom link class, persona-button
        # should be added to the link class.
        with self.settings(LOGIN_REDIRECT_URL='/'):
            button = helpers.browserid_login(link_class='go button', color='dark')
        self.assertHTMLEqual(button, """
            <a href="#" class="go button persona-button dark" data-next="/">
                <span>Sign in</span>
            </a>
        """)

    def test_next(self):
        button = helpers.browserid_login(next='/foo/bar')
        self.assertHTMLEqual(button, """
            <a href="#" class="browserid-login persona-button" data-next="/foo/bar">
                <span>Sign in</span>
            </a>
        """)

    def test_next_default(self):
        # next should default to LOGIN_REDIRECT_URL
        with self.settings(LOGIN_REDIRECT_URL='/foo/bar'):
            button = helpers.browserid_login()
        self.assertHTMLEqual(button, """
            <a href="#" class="browserid-login persona-button" data-next="/foo/bar">
                <span>Sign in</span>
            </a>
        """)


class BrowserIDLogoutTests(TestCase):
    def test_logout_class(self):
        with self.settings(LOGOUT_REDIRECT_URL='/'):
            button = helpers.browserid_logout(link_class='go button')
        self.assertHTMLEqual(button, """
            <a href="/browserid/logout/" class="go button" data-next="/">
                <span>Sign out</span>
            </a>
        """)

    def test_next(self):
        button = helpers.browserid_logout(next='/foo/bar')
        self.assertHTMLEqual(button, """
            <a href="/browserid/logout/" class="browserid-logout" data-next="/foo/bar">
                <span>Sign out</span>
            </a>
        """)

    def test_next_default(self):
        # next should default to LOGOUT_REDIRECT_URL
        with self.settings(LOGOUT_REDIRECT_URL='/foo/bar'):
            button = helpers.browserid_logout()
        self.assertHTMLEqual(button, """
            <a href="/browserid/logout/" class="browserid-logout" data-next="/foo/bar">
                <span>Sign out</span>
            </a>
        """)
