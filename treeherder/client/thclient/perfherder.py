from .client import TreeherderClient


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
                PerformanceTimeInterval.NINETY_DAYS,
                PerformanceTimeInterval.ONE_YEAR]


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
        signature = '9cfc271dab9b7fc2c1229736fecfbbc6e7c5fac9'
        series = pc.get_performance_data('mozilla-central', signature=signature)[signature]
        (result_set_ids, geomeans) = (series['result_set_id'], series['geomean'])
    '''

    def __getitem__(self, key):
        return map(lambda el: el[key], self)


class PerfherderClient(TreeherderClient):

    PERFORMANCE_SIGNATURES_ENDPOINT = 'performance/signatures'
    PERFORMANCE_DATA_ENDPOINT = 'performance/data'

    def get_performance_signatures(self, project, **params):
        '''
        Gets a set of performance signatures associated with a project and time range
        '''
        return PerformanceSignatureCollection(self._get_json(
            self.PERFORMANCE_SIGNATURES_ENDPOINT, None, project, **params))

    def get_performance_data(self, project, **params):
        '''
        Gets a dictionary of PerformanceSeries objects

        You can specify which signatures to get by passing signature to this function
        '''
        results = self._get_json(self.PERFORMANCE_DATA_ENDPOINT, None, project,
                                 **params)

        return {k: PerformanceSeries(v) for k, v in results.items()}
