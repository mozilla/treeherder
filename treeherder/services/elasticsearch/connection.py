from django.conf import settings
from elasticsearch import Elasticsearch

es_conn = Elasticsearch(settings.ELASTICSEARCH_URL)
