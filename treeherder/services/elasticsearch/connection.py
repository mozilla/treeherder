from django.conf import settings
from pyelasticsearch import ElasticSearch

es_conn = ElasticSearch(settings.ELASTICSEARCH_URL)
