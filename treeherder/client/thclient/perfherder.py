# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from .client import TreeherderClient, TreeherderClientError


class TimeInterval(object):
    DAY = 86400
    WEEK = 604800
    TWO_WEEKS = 1209600
    SIXTY_DAYS = 5184000
    NINETY_DAYS = 7776000


class SignatureList(object):

    def __init__(self, signatures):
        self.signatures = signatures

    def __len__(self):
        return len(self.signatures)

    def __getitem__(self, key):
        return self.signatures.get(key)

    def filter(self, *args):
        filtered_signatures = {}
        for (signature, signature_value) in self.signatures.iteritems():
            skip = False
            for (key, val) in args:
                if signature_value.get(key) != val:
                    skip = True
                    break
            if not skip:
                filtered_signatures[signature] = signature_value
        return SignatureList(filtered_signatures)

    def get_signature_hashes(self):
        return self.signatures.keys()

    def get_property_names(self):
        property_names = set()
        for signature_value in self.signatures.values():
            for property_name in signature_value.keys():
                property_names.add(property_name)
        return property_names

    def get_property_values(self, property_name):
        property_values = set()
        for signature_value in self.signatures.values():
            if signature_value.get(property_name):
                property_values.add(signature_value[property_name])
        return property_values


class Series(object):

    def __init__(self, blob):
        self.blob = blob

    def __getitem__(self, key):
        return map(lambda el: el[key], self.blob)

class PerfherderClient(TreeherderClient):

    PERFORMANCE_SERIES_SUMMARY_ENDPOINT = 'performance-data/0/get_performance_series_summary/?interval={}'
    SIGNATURE_PROPERTIES_ENDPOINT = 'performance-data/0/get_signature_properties/?signatures={}'
    PERFORMANCE_DATA_ENDPOINT = 'performance-data/0/get_performance_data/?interval_seconds={}'

    def get_performance_signatures(
            self, project, time_interval=TimeInterval.WEEK):
        return SignatureList(self._get_json(
            project, self.PERFORMANCE_SERIES_SUMMARY_ENDPOINT.format(
                time_interval)))

    def get_performance_signature_properties(self, project, signature):
        endpoint = self.SIGNATURE_PROPERTIES_ENDPOINT.format(signature)
        property_list = self._get_json(project, endpoint)
        if len(property_list) != 1:
            raise TreeherderClientError(
                "Expected 1 result for call to '{1}', got '{2}'".format(
                    endpoint, len(property_list)))
        return property_list[0]

    def get_performance_series_list(self, project, signature_list,
                        time_interval=TimeInterval.WEEK):
        endpoint = self.PERFORMANCE_DATA_ENDPOINT.format(time_interval)
        for signature in signature_list:
            endpoint += '&signatures=%s' % signature
        results = self._get_json(project, endpoint)
        if len(results) != len(signature_list):
            raise TreeherderClientError(
                "Expected 1 result for call to '{1}', got '{2}'".format(
                    endpoint, len(results)))
        result_map = {}
        for dict in results:
            result_map[dict['series_signature']] = dict['blob']

        return [Series(result_map[signature]) for signature in signature_list]

    def get_performance_series(self, project, signature,
                               time_interval=TimeInterval.WEEK):
        return self.get_performance_series_list(
            project, [signature], time_interval=time_interval)[0]
