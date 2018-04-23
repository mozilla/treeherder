from django.conf import settings
from elasticsearch import Elasticsearch

url = settings.ELASTICSEARCH_URL
es_conn = Elasticsearch(url) if url else None
