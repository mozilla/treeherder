import datetime
import json
import time
from collections import defaultdict

from rest_framework import (exceptions,
                            viewsets)
from rest_framework.response import Response

from treeherder.model import models
from treeherder.perf.models import (PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceSignature)


class PerformanceSignatureViewSet(viewsets.ViewSet):

    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_data = PerformanceSignature.objects.filter(
            repository=repository).select_related(
                'option_collection', 'platform')

        # filter based on signature hashes, if asked
        signature_hashes = request.query_params.getlist('signature')
        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                signature_hash__in=signature_hashes).values_list('id', flat=True)
            signature_data = signature_data.filter(id__in=list(
                signature_ids))

        interval = request.query_params.get('interval')
        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.fromtimestamp(
                    int(time.time() - int(interval))))

        platform = request.query_params.get('platform')
        if platform:
            platforms = models.MachinePlatform.objects.filter(
                platform=platform)
            signature_data = signature_data.filter(
                platform__in=platforms)

        ret = {}
        for (signature_hash, option_collection_hash, platform, suite, test,
             lower_is_better, extra_properties) in signature_data.values_list(
                 'signature_hash',
                 'option_collection__option_collection_hash',
                 'platform__platform', 'suite',
                 'test', 'lower_is_better', 'extra_properties').distinct():
            ret[signature_hash] = {
                'option_collection_hash': option_collection_hash,
                'machine_platform': platform,
                'suite': suite
            }
            if not lower_is_better:
                # almost always true, save some banwidth by assuming that by
                # default
                ret[signature_hash]['lower_is_better'] = False
            if test:
                # test may be empty in case of a summary test, leave it empty then
                ret[signature_hash]['test'] = test
            ret[signature_hash].update(json.loads(extra_properties))

        return Response(ret)


class PerformancePlatformViewSet(viewsets.ViewSet):
    """
    All platforms for a particular branch that have performance data
    """
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)
        return Response(PerformanceSignature.objects.filter(
            repository=repository).values_list(
                'platform__platform', flat=True).distinct())


class PerformanceDatumViewSet(viewsets.ViewSet):
    """
    This view serves performance test result data
    """
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_hashes = request.query_params.getlist("signatures")
        result_set_ids = request.query_params.getlist("result_set_id")
        job_ids = request.query_params.getlist("job_id")

        if not (signature_hashes or result_set_ids or job_ids):
            raise exceptions.ValidationError('Need to specify either '
                                             'signatures, result_set_id, or '
                                             'job_id')

        datums = PerformanceDatum.objects.filter(
            repository=repository).select_related(
                'signature__signature_hash').order_by('push_timestamp')

        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                repository=repository,
                signature_hash__in=signature_hashes).values_list('id', flat=True)
            datums = datums.filter(signature__id__in=list(signature_ids))
        if result_set_ids:
            datums = datums.filter(result_set_id__in=result_set_ids)
        if job_ids:
            datums = datums.filter(job_id__in=job_ids)

        interval = request.query_params.get('interval')
        if interval:
            datums = datums.filter(
                push_timestamp__gt=datetime.datetime.fromtimestamp(
                    int(time.time() - int(interval))))

        ret = defaultdict(list)
        values_list = datums.values_list(
            'signature__signature_hash', 'job_id', 'result_set_id',
            'push_timestamp', 'value')
        for (signature_hash, job_id, result_set_id, push_timestamp,
             value) in values_list:
            ret[signature_hash].append({
                'job_id': job_id,
                'result_set_id': result_set_id,
                'push_timestamp': int(time.mktime(push_timestamp.timetuple())),
                'value': round(value, 2)  # round to 2 decimal places
            })

        return Response(ret)


class PerformanceAlertSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the performance alert model"""

    def list(self, request):
        ids = request.query_params.getlist("id")
        if ids:
            summaries = PerformanceAlertSummary.objects.filter(
                id__in=ids)
        else:
            # by default get "count" performance summaries, indexed by
            # "offset" to the latest entry
            offset = int(request.query_params.get("offset", 0))
            count = min(int(request.query_params.get("count", 10)), 100)
            print (offset, count)
            summaries = PerformanceAlertSummary.objects.order_by('-last_updated')[offset:offset+count]

        ret = []
        for summary in summaries:
            summarydict = {
                'id': summary.id,
                'prev_result_set_id': summary.prev_result_set_id,
                'result_set_id': summary.result_set_id,
                'repository': summary.repository.name,
                'alerts': []
            }
            for alert in summary.generated_alerts.all():
                alertdict = {
                    'suite': alert.series_signature.suite,
                    'test': alert.series_signature.test,
                    'option_collection_hash': alert.series_signature.option_collection.option_collection_hash,
                    'extra_properties': alert.series_signature.extra_properties,
                    'machine_platform': alert.series_signature.platform.platform,
                    'signature_hash': alert.series_signature.signature_hash,
                    'prev_result_set_id': alert.prev_result_set_id,
                    'result_set_id': alert.result_set_id,
                    'prev_value': round(alert.prev_value, 2),
                    'new_value': round(alert.new_value, 2),
                    'amount_pct': round(alert.amount_pct, 2),
                    'amount_abs': round(alert.amount_abs, 2),
                    'is_regression': alert.is_regression,
                    't_value': round(alert.t_value, 2)
                }
                if alert.series_signature.test:
                    alertdict.update({'test': alert.series_signature.test})
                test_options = alert.series_signature.extra_properties.get(
                    'test_options')
                if test_options:
                    alertdict['test_options'] = test_options

                summarydict['alerts'].append(alertdict)

            ret.append(summarydict)

        return Response(ret)
