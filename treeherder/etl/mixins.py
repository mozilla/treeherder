from treeherder.etl import th_publisher


class ClientLoaderMixin(object):

    def load(self, th_collections, chunk_size=1):
        if th_collections:
            th_publisher.post_treeherder_collections(th_collections, chunk_size)
