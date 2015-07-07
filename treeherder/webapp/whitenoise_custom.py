# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from whitenoise.django import DjangoWhiteNoise


class CustomWhiteNoise(DjangoWhiteNoise):

    INDEX_NAME = 'index.html'

    def add_files(self, *args, **kwargs):
        super(CustomWhiteNoise, self).add_files(*args, **kwargs)
        index_page_suffix = "/" + self.INDEX_NAME
        index_name_length = len(self.INDEX_NAME)
        index_files = {}
        for url, static_file in self.files.items():
            # Add an additional fake filename to serve index pages for '/'.
            if url.endswith(index_page_suffix):
                index_files[url[:-index_name_length]] = static_file
        self.files.update(index_files)

    def find_file(self, url):
        # In debug mode, find_file() is used to serve files directly from the filesystem
        # instead of using the list in `self.files`, so we append the index filename so
        # that will be served if present.
        if url[-1] == '/':
            url += self.INDEX_NAME
        return super(CustomWhiteNoise, self).find_file(url)
