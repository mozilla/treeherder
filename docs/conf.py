import sphinx_rtd_theme
from recommonmark.parser import CommonMarkParser
from recommonmark.transform import AutoStructify

# The master toctree document.
master_doc = 'index'

project = u'Treeherder'
copyright = u'Mozilla and other contributors'

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
exclude_patterns = ['_build']

html_theme = 'sphinx_rtd_theme'
html_theme_path = [sphinx_rtd_theme.get_html_theme_path()]

source_parsers = {
    '.md': CommonMarkParser,
}

source_suffix = ['.rst', '.md']


def setup(app):
    # Enable additional recommonmark features:
    # https://recommonmark.readthedocs.io/en/latest/auto_structify.html
    app.add_transform(AutoStructify)
