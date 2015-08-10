from .client import TreeherderClient, TreeherderClientError


class PerformanceTimeInterval(object):
    '''
    Valid time intervals for Perfherder series
    '''
    DAY = 86400
    WEEK = 604800
    TWO_WEEKS = 1209600
    SIXTY_DAYS = 5184000
    NINETY_DAYS = 7776000
    ONE_YEAR = 31536000

    @staticmethod
    def all_valid_time_intervals():
        '''
        Helper method to return all possible valid time intervals for data
        stored by Perfherder
        '''
        return [PerformanceTimeInterval.DAY,
                PerformanceTimeInterval.WEEK,
                PerformanceTimeInterval.TWO_WEEKS,
                PerformanceTimeInterval.SIXTY_DAYS,
                PerformanceTimeInterval.NINETY_DAYS]


class PerformanceSignatureCollection(dict):
    '''
    Represents a collection of performance signatures in Perfherder
    '''

    def filter(self, *args):
        '''
        Returns a filtered subset of this collection of signatures, based on
        a set of key/value tuples

        This is useful when you only want a subset of the signatures in a project.

        Example usage:

        ::
            pc = PerfherderClient()
            signatures = pc.get_signatures('mozilla-central')
            signatures = signatures.filter(('suite', 'tp5o'), ('machine_platform', 'windowsxp'))
        '''
        filtered_signatures = {}
        for (signature, signature_value) in self.iteritems():
            skip = False
            for (key, val) in args:
                if signature_value.get(key) != val:
                    skip = True
                    break
            if not skip:
                filtered_signatures[signature] = signature_value

        return PerformanceSignatureCollection(filtered_signatures)

    def get_signature_hashes(self):
        '''
        Return all signature hashes in this collection
        '''
        return self.keys()

    def get_property_names(self):
        '''
        Returns all property names in this collection of signatures
        '''
        property_names = set()
        for signature_value in self.values():
            for property_name in signature_value.keys():
                property_names.add(property_name)
        return property_names

    def get_property_values(self, property_name):
        '''
        Returns all property values for a particular property name in this collection
        '''
        property_values = set()
        for signature_value in self.values():
            if signature_value.get(property_name):
                property_values.add(signature_value[property_name])
        return property_values


class PerformanceSeries(list):
    '''
    Represents a series of performance observations

    You can access the individual elements of the series by using the []
    syntax. For example, to get the result set ids and geometric means
    in a summary series:

    ::
        pc = PerfherderClient()
        series = pc.get_performance_series('mozilla-central', '9cfc271dab9b7fc2c1229736fecfbbc6e7c5fac9')
        (result_set_ids, geomeans) = (series['result_set_id'], series['geomean'])
    '''

    def __getitem__(self, key):
        return map(lambda el: el[key], self)


class PerfherderClient(TreeherderClient):

    PERFORMANCE_SERIES_SUMMARY_ENDPOINT = 'performance-data/get_performance_series_summary'
    SIGNATURE_PROPERTIES_ENDPOINT = 'performance-data/get_signature_properties'
    PERFORMANCE_DATA_ENDPOINT = 'performance-data/get_performance_data'

    def get_performance_signatures(self, project,
                                   time_interval=PerformanceTimeInterval.WEEK,
                                   timeout=None):
        '''
        Gets a set of performance signatures associated with a project and time range
        '''
        return PerformanceSignatureCollection(self._get_json(
            self.PERFORMANCE_SERIES_SUMMARY_ENDPOINT, timeout, project,
            interval=time_interval))

    def get_performance_signature_properties(self, project, signature,
                                             timeout=None):
        '''
        Gets the set of properties associated with a specific signature
        '''
        property_list = self._get_json(self.SIGNATURE_PROPERTIES_ENDPOINT,
                                       timeout, project, signatures=signature)
        if len(property_list) != 1:
            raise TreeherderClientError(
                "Expected 1 result for call to '{0}', got '{1}'".format(
                    self.SIGNATURE_PROPERTIES_ENDPOINT, len(property_list)),
                [])

        return property_list[0]

    def get_performance_series_list(self, project, signature_list,
                                    time_interval=PerformanceTimeInterval.WEEK,
                                    timeout=None):
        '''
        Gets a list of series objects associated with a set of signatures
        '''
        results = self._get_json(self.PERFORMANCE_DATA_ENDPOINT, timeout, project,
                                 signatures=signature_list,
                                 interval_seconds=time_interval)
        if len(results) != len(signature_list):
            raise TreeherderClientError(
                "Expected {0} results for call to '{1}', got '{2}'".format(
                    len(signature_list),
                    self.PERFORMANCE_DATA_ENDPOINT, len(results)), [])
        result_map = {}
        for dict in results:
            result_map[dict['series_signature']] = dict['blob']

        return [PerformanceSeries(result_map[signature]) for signature in
                signature_list]

    def get_performance_series(self, project, signature,
                               time_interval=PerformanceTimeInterval.WEEK,
                               timeout=None):
        '''
        Gets the performance series corresponding to a particular signature
        '''
        return self.get_performance_series_list(
            project, [signature], time_interval=time_interval,
            timeout=timeout)[0]
