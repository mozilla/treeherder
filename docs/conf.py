import sphinx_rtd_theme

# The master toctree document.
master_doc = 'index'

project = u'Treeherder'
copyright = u'Mozilla and other contributors'

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
exclude_patterns = ['_build']

html_theme = 'sphinx_rtd_theme'
html_theme_path = [sphinx_rtd_theme.get_html_theme_path()]
