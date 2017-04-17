from django.test import TestCase

from django_ci.models import (DataIngestionManager, Product,
                              Repository, ResultSet, Revision)
from django_ci.api import serializers



class DataIngestionTestCase(TestCase):

    fixtures=['repository', 'repository_group']

    def test_data_ingestion_model_has_custom_manager(self):
        self.assertIsInstance(Product.objects, DataIngestionManager,
                              'DataIngestionModel should have a DataIngestionManager manager')

    def test_bulk_try_create_new(self):
        p1 = Product(name='Foo1', description='Bar1')
        p2 = Product(name='Foo2', description='Bar2')

        stored_products = Product.objects.bulk_try_create(
            ('name',), p1, p2)

        self.assertEqual(len(stored_products), 2,
                         'There should be 2 new objects stored')

        self.assertTrue(all([p.pk for p in stored_products]),
                         'Objects returned by bulk_try_create should always have a pk set')

    def test_bulk_try_create_dupes(self):
        p1 = Product(name='Foo1', description='Bar1')
        p2 = Product(name='Foo1', description='Bar2')

        Product.objects.bulk_try_create(
            ('name',), p1, p2)

        stored_objects = Product.objects.all()

        self.assertEqual(len(stored_objects), 1,
                         'No dupes should be stored')

        self.assertIsNot(stored_objects[0].pk, None,
                         'Objects returned by bulk_try_create should always have a pk set')

    def test_bulk_try_create_with_foreign_key(self):

        repository = Repository.objects.get(name='my_repo')

        revision = Revision(
            repository=repository,
            revision='abcdef123456',
            author='John Doe',
            comments='My comment',
            commit_timestamp=1234567891
        )
        stored_objects = Revision.objects.bulk_try_create(
            ('repository', 'revision'), revision)

        self.assertEqual(len(stored_objects), 1,
                         'It should be possible to store an object with foreign keys')


class RevisionSerializerTestCase(TestCase):

    fixtures=['repository', 'repository_group']

    def test_valid_revision_serializer(self):
        data = {
            'comment': 'My comment',
            'repository': 'my_repo',
            'author': 'John Doe',
            'branch': 'default',
            'revision': 'cdfe03e77e66'
        }
        serializer = serializers.RevisionSerializer(data=data)

        self.assertTrue(serializer.is_valid(),
                        'RevisionSerializer validation should pass on valid data')

    def test_valid_revision_serializer(self):
        data = {
            'comment': 'My comment',
            'repository': 'my_repo',
            # we are missing the author here
            'branch': 'default',
            'revision': 'cdfe03e77e66'
        }
        serializer = serializers.RevisionSerializer(data=data)

        self.assertFalse(serializer.is_valid(),
                        'RevisionSerializer validation should fail on invalid data')

    def test_revision_serializer_create(self):
        data = {
            'comment': 'My comment',
            'repository': 'my_repo',
            'author': 'John Doe',
            'branch': 'default',
            'revision': 'cdfe03e77e66'
        }
        serializer = serializers.RevisionSerializer(data=data)

        self.assertTrue(serializer.is_valid(),
                        'RevisionSerializer validation should pass on valid data')

        revision = serializer.create(serializer.validated_data)

        self.assertIsInstance(revision, Revision,
                        'RevisionSerializer.create should return a Revision')

        self.assertIsNot(revision.pk, None)

    def test_revision_serializer_create_list(self):
        data = [
            {
                'comment': 'First comment',
                'repository': 'my_repo',
                'author': 'John Doe',
                'branch': 'default',
                'revision': 'abcd03e77e66'
            },
            {
                'comment': 'Second comment',
                'repository': 'my_repo',
                'author': 'John Doe',
                'branch': 'default',
                'revision': 'fe1203e77e66'
            },
        ]
        serializer = serializers.RevisionSerializer(data=data, many=True)

        self.assertTrue(serializer.is_valid(),
                        'RevisionSerializer validation should pass on valid data')

        revisions = serializer.create(serializer.validated_data)

        self.assertEqual(len(revisions), 2,
                        'RevisionSerializer.create should return a list of revisions'
                         ' when initialized with many=True')

        all_revisions_stored = all([r.pk is not None for r in revisions])
        self.assertTrue(all_revisions_stored)


class ResultSetSerializerTestCase(TestCase):

    fixtures=['repository', 'repository_group']

    def test_result_set_serializer_create(self):
        data = {
            'revision_hash': '8afdb7debc82a8b6e0d56449dfdf916c77a7bf80',
            'push_timestamp': 1378293517,
            'author': 'some-sheriff@mozilla.com',
            'repository': 'my_repo',
            'revisions': [{
                'comment': 'My comment',
                'repository': 'my_repo',
                'author': 'John Doe',
                'branch': 'default',
                'revision': 'cdfe03e77e66'
            }]
        }
        serializer = serializers.ResultSetSerializer(data=data)

        self.assertTrue(serializer.is_valid(),
                        'ResultSetSerializer validation should pass on valid data')

        result_set = serializer.create(serializer.validated_data)

        self.assertIsInstance(result_set, ResultSet,
                        'ResultSetSerializer.create should return a Revision')

        self.assertIsNot(result_set.pk, None)

    def test_result_set_serializer_create_list(self):
        data = [
            {
                'revision_hash': '8afdb7debc82a8b6e0d56449dfdf916c77a7bf80',
                'push_timestamp': 1378293517,
                'author': 'some-sheriff@mozilla.com',
                'repository': 'my_repo',
                'revisions': [{
                    'comment': 'My comment',
                    'repository': 'my_repo',
                    'author': 'John Doe',
                    'branch': 'default',
                    'revision': 'cdfe03e77e66'
                }]
            },
            {
                'revision_hash': '1afdb7debc82a8b6e0d56449dfdf916c77a7bf90',
                'push_timestamp': 1378293517,
                'author': 'some-sheriff@mozilla.com',
                'repository': 'my_repo',
                'revisions': [{
                    'comment': 'My comment',
                    'repository': 'my_repo',
                    'author': 'John Doe',
                    'branch': 'default',
                    'revision': '123456123456'
                }]
            }
        ]
        serializer = serializers.ResultSetSerializer(data=data, many=True)

        self.assertTrue(serializer.is_valid(),
                        'ResultSetSerializer validation should pass on valid data')

        result_set_list = serializer.create(serializer.validated_data)

        self.assertEqual(len(result_set_list), 2,
                        'ResultSetSerializer.create should return a list of result sets'
                         ' when initialized with many=True')

        all_result_set_stored = all([r.pk is not None for r in result_set_list])
        self.assertTrue(all_result_set_stored)
