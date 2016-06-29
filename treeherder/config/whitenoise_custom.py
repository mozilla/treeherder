import re

from whitenoise.middleware import WhiteNoiseMiddleware


class CustomWhiteNoise(WhiteNoiseMiddleware):
    """
    Adds two additional features to WhiteNoise:

    1) Serving index pages for directory paths (such as the site root).
    2) Setting long max-age headers for files created by grunt-cache-busting.
    """

    # Matches grunt-cache-busting's style of hash filenames. eg:
    #   index.min-feae259e2c205af67b0e91306f9363fa.js
    IMMUTABLE_FILE_RE = re.compile(r'\.min-[a-f0-9]{32}\.(js|css)$')
    INDEX_NAME = 'index.html'

    def update_files_dictionary(self, *args):
        """Add support for serving index pages for directory paths."""
        super(CustomWhiteNoise, self).update_files_dictionary(*args)
        index_page_suffix = '/' + self.INDEX_NAME
        index_name_length = len(self.INDEX_NAME)
        updated_files_dict = {}
        maintenance_page = self.files.get('/maintenance.html')
        for url, static_file in self.files.items():
            # Serve the maintenance page instead of any other static file content.
            updated_files_dict[url] = maintenance_page
            if url.endswith(index_page_suffix):
                # For each index file found, add a corresponding URL->content mapping
                # for the file's parent directory, so that the index page is served for
                # the bare directory URL ending in '/'.
                parent_directory_url = url[:-index_name_length]
                updated_files_dict[parent_directory_url] = maintenance_page
        self.files.update(updated_files_dict)

    def find_file(self, url):
        """Add support for serving index pages for directory paths when in DEBUG mode."""
        # In debug mode, find_file() is used to serve files directly from the filesystem
        # instead of using the list in `self.files`, so we append the index filename so
        # that will be served if present.
        if url.endswith('/'):
            url += self.INDEX_NAME
        return super(CustomWhiteNoise, self).find_file(url)

    def is_immutable_file(self, path, url):
        """Support grunt-cache-busting style filenames when setting long max-age headers."""
        if self.IMMUTABLE_FILE_RE.search(url):
            return True
        # Otherwise fall back to the default method, so we catch filenames in the
        # style output by GzipManifestStaticFilesStorage during collectstatic. eg:
        #   bootstrap.min.abda843684d0.js
        return super(CustomWhiteNoise, self).is_immutable_file(path, url)
