import django.dispatch

post_data_ingested = django.dispatch.Signal(providing_args=["identifier", "object_list"])