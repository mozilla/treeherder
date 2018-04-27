import os

from django.conf import settings
from elasticsearch import Elasticsearch

url = settings.ELASTICSEARCH_URL


def build_connection(url):
    """
    Build an Elasticsearch connection with the given url

    Elastic.co's Heroku addon doesn't create credientials with access to the
    cluster by default so they aren't exposed in the URL they provide either.
    This function works around the situation by grabbing our credentials from
    the environment via Django settings and building a connection with them.
    """
    username = os.environ.get('ELASTICSEARCH_USERNAME')
    password = os.environ.get('ELASTICSEARCH_PASSWORD')

    if username and password:
        return Elasticsearch(url, http_auth=(username, password))

    return Elasticsearch(url)


es_conn = build_connection(url) if url else None
