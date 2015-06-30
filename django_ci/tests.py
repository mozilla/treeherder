from django.test import TestCase

from django_ci.models import Product
from django_ci.models.manager import DataIngestionManager


class DataIngestionTestCase(TestCase):

    def test_data_gestion_model_has_custom_manager(self):
        self.assertIsInstance(Product.objects, DataIngestionManager,
                              "DataIngestionModel should have a DataIngestionManager manager")

    def test_bulk_try_create_new(self):
        p1 = Product(name="Foo1", description="Bar1")
        p2 = Product(name="Foo2", description="Bar2")

        Product.objects.bulk_try_create(
            ('name',), p1, p2)

        stored_objects = Product.objects.all()

        self.assertEqual(len(stored_objects), 2,
                         "New objects should be inserted")

    def test_bulk_try_create_dupes(self):
        p1 = Product(name="Foo1", description="Bar1")
        p2 = Product(name="Foo1", description="Bar2")

        Product.objects.bulk_try_create(
            ('name',), p1, p2)

        stored_objects = Product.objects.all()

        self.assertEqual(len(stored_objects), 1,
                         "No dupes should be stored")
