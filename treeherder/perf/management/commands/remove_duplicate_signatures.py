import datetime
import json
import time
from optparse import make_option

from django.core.management.base import BaseCommand
from django.db import (connection,
                       reset_queries)
from django.db.models import Count
from django.db.utils import IntegrityError

from treeherder.etl.perf import _get_signature_hash
from treeherder.model.models import (Datasource,
                                     MachinePlatform,
                                     OptionCollection,
                                     Repository)
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceDatum,
                                    PerformanceSignature)


class Command(BaseCommand):
    help = "migrate legacy signature data to new schema, which encodes subtests"
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter deletion to particular project(s)',
                    type='string'),
        make_option('--no-subtests',
                    dest='no_subtests',
                    help='Don\'t process subtests',
                    action='store_true'),
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between signature migrations',
                    type='float',
                    default=0.0),
        make_option('--delete',
                    dest='delete',
                    help='remove orphan signatures after migration',
                    action='store_true',
                    default=False),
        make_option('--age',
                    dest='age',
                    help='maximum age of datum to update',
                    type='int',
                    default=30)
    )

    def _reassign_signatures(self, old_signature_ids, new_signature, options,
                             i):
        start_time = time.time()
        datums = PerformanceDatum.objects.filter(
            signature_id__in=old_signature_ids)
        if options['age']:
            n_days_ago = datetime.datetime.now() + datetime.timedelta(-1 *
                                                                      options['age'])
            datums.filter(push_timestamp__gt=n_days_ago)
        try:
            datums.update(signature=new_signature)
        except IntegrityError:
            # fall back to update ignore
            with connection.cursor() as cursor:
                for old_signature_id in old_signature_ids:
                    cursor.execute(
                        '''
                        UPDATE ignore performance_datum set signature_id=%s where signature_id=%s
                        ''', [new_signature.id, old_signature_id])
            PerformanceDatum.objects.filter(signature_id__in=old_signature_ids).delete()
        alerts = PerformanceAlert.objects.filter(
            series_signature_id__in=old_signature_ids)
        try:
            for alert in alerts:
                alert.series_signature = new_signature
                alert.save(update_fields=['series_signature'])
        except IntegrityError:
            alert.delete()
        print "{} - {}: {} [{}]".format(i, len(old_signature_ids),
                                        new_signature.signature_hash,
                                        time.time() - start_time)
        time.sleep(options['interval'])

    def _get_revised_signature_hash(self, signature, parent=False):
        signature_properties = {
            'suite': signature.suite,
            'option_collection_hash': self.option_collection_hash_map[signature.option_collection_id],
            'machine_platform': self.platform_name_map[signature.platform_id],
            'lowerIsBetter': signature.lower_is_better
        }
        parent_signature_id = None
        if (signature.extra_properties and
            signature.extra_properties.get('test_options')) == ['e10s']:
            signature_properties['test_options'] = json.dumps(['e10s'])
        if not parent and len(signature.test):
            signature_properties['test'] = signature.test
            # try to get a parent signature hash (if one exists)
            if signature.parent_signature_id:
                (parent_signature_hash, _) = self._get_revised_signature_hash(
                    signature, parent=True)
                try:
                    parent_signature_id = self.parent_signature_id_map.get(parent_signature_hash)
                    if not parent_signature_id:
                        parent_signature_id = PerformanceSignature.objects.values_list('id', flat=True).get(
                            repository=signature.repository,
                            framework=signature.framework,
                            signature_hash=parent_signature_hash)
                        self.parent_signature_id_map[parent_signature_hash] = parent_signature_id
                except PerformanceSignature.DoesNotExist:
                    if signature.parent_signature_id:
                        # there should be a parent signature for this test, but
                        # isn't.. wait for next iteration
                        return (None, None)
                if parent_signature_id:
                    signature_properties['parent_signature'] = parent_signature_hash
        return (_get_signature_hash(signature_properties), parent_signature_id)
    def handle(self, *args, **options):
        if options['project']:
            projects = options['project']
        else:
            projects = Datasource.objects.values_list('project', flat=True)
        self.option_collection_hash_map = {
            id: option_collection_hash for
            (id, option_collection_hash) in
            OptionCollection.objects.values_list('id', 'option_collection_hash')
        }
        self.platform_name_map = {
            id: platform for
            (id, platform) in
            MachinePlatform.objects.values_list('id', 'platform')
        }
        signature_hashes_seen = set()
        for project in projects:
            self.parent_signature_id_map = {}
            self.revised_signature_map = {}
            i = 0
            print project
            try:
                repository = Repository.objects.get(name=project)
            except Repository.DoesNotExist:
                continue
            signatures = PerformanceSignature.objects.filter(
                repository=repository
            ).order_by('id').only('parent_signature_id', 'test', 'suite',
                                  'option_collection', 'platform',
                                  'extra_properties', 'lower_is_better',
                                  'has_subtests', 'last_updated')
            if options['no_subtests']:
                signatures = signatures.filter(parent_signature=None)
            print signatures.count()
            for signature in signatures.iterator():
                if signature.signature_hash in signature_hashes_seen:
                    continue
                signature_hashes_seen.add(signature.signature_hash)
                (revised_signature_hash, parent_signature_id) = self._get_revised_signature_hash(signature)
                if revised_signature_hash and revised_signature_hash != signature.signature_hash:
                    revised_signature, _ = PerformanceSignature.objects.get_or_create(
                        repository=repository,
                        signature_hash=revised_signature_hash,
                        framework=signature.framework,
                        defaults={
                            'parent_signature_id': parent_signature_id,
                            'test': signature.test,
                            'suite': signature.suite,
                            'option_collection': signature.option_collection,
                            'platform': signature.platform,
                            'extra_properties': signature.extra_properties,
                            'lower_is_better': signature.lower_is_better,
                            'has_subtests': signature.has_subtests,
                            'last_updated': signature.last_updated
                        })
                    # look for other signature hashes that are also duplicates
                    signatures_to_reassign = PerformanceSignature.objects.filter(
                        repository=repository,
                        framework=signature.framework,
                        platform=signature.platform,
                        option_collection=signature.option_collection,
                        suite=signature.suite,
                        test=signature.test,
                        lower_is_better=signature.lower_is_better).exclude(
                            signature_hash=revised_signature.signature_hash)
                    if (signature.extra_properties and
                        signature.extra_properties.get('test_options')) == ['e10s']:
                        signatures_to_reassign = signatures_to_reassign.filter(
                            extra_properties__contains='e10s')
                    else:
                        signatures_to_reassign = signatures_to_reassign.exclude(
                            extra_properties__contains='e10s')
                    signature_hashes_seen = signature_hashes_seen.union(
                        signatures_to_reassign.values_list(
                            'signature_hash', flat=True))
                    signatures_to_reassign_ids = set(signatures_to_reassign.values_list(
                        'id', flat=True))
                    self._reassign_signatures(signatures_to_reassign_ids,
                                              revised_signature, options,
                                              i)
                    i += len(signatures_to_reassign)
                elif (parent_signature_id and
                      signature.parent_signature_id != parent_signature_id):
                    signature.parent_signature = parent_signature_id
                    signature.parent_signature.has_subtests = True
                    signature.parent_signature.save()
                    signature.save()
                    i += 1
                reset_queries()
            if options['delete']:
                print "Deleting signatures who don't have perf datums (anymore)..."
                empty = PerformanceSignature.objects.filter(
                    repository=repository).annotate(
                        num_datums=Count('performancedatum')).filter(
                            num_datums=0).values_list('id', flat=True)
                chunk_size = 100
                for i in xrange(0, len(empty), chunk_size):
                    PerformanceSignature.objects.filter(
                        id__in=empty[i:i+chunk_size]).delete()

