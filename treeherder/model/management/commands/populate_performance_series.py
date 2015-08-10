import sys
from optparse import make_option

import simplejson as json
from django.core.management.base import BaseCommand

from treeherder.model.tasks import populate_performance_series


class Command(BaseCommand):
    help = """Poplate performance series data"""

    option_list = BaseCommand.option_list + (

        make_option('--debug',
                    action='store_true',
                    dest='debug',
                    default=None,
                    help='Write debug messages to stdout'),

        make_option('--result_set_id',
                    dest='result_set_id',
                    default=None,
                    help='Increment result_set id to test adding to one set of structure'),

        make_option('--push_timestamp',
                    dest='push_timestamp',
                    default=None,
                    help='Specify the push_timestamp for the default data structure'),

        make_option('--project',
                    dest='project',
                    default='mozilla-inbound',
                    help='Project name to store data in.'),

        make_option('--show_default_data',
                    action='store_true',
                    dest='show_default_data',
                    default=None,
                    help='Write default data structure to stdout'),

    )

    default_data = {
        '4aa266824dbe623696a767d59de310a05bef21f5': [
            {'std': '50.2', 'result_set_id': 11, 'job_id': 1121,
             'min': 2474.0, 'max': 2642.0, 'median': '2525.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '2524.7'}
        ],
        '930295ab2dedff613f888c002cc471e055cf89ee': [
            {'std': '35.0', 'result_set_id': 11, 'job_id': 1121,
             'min': 1156.0, 'max': 1359.0, 'median': '1228.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '1228.0'}
        ],
        '843a5600f1d4b964526fde76e073c50a8e69497f': [
            {'std': '29.3', 'result_set_id': 11, 'job_id': 1121,
             'min': 827.0, 'max': 880.0, 'median': '861.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '860.6'}
        ],
        'e07ff2a8e874e066ad680a4c61d65486877ef5a3': [
            {'std': '44.9', 'result_set_id': 11, 'job_id': 1121,
             'min': 1935.0, 'max': 2540.0, 'median': '2020.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '2020.1'}
        ],
        'b8d07a1a082d93f87cde13cbd9c571259d5b30cb': [
            {'std': '26.0', 'result_set_id': 11, 'job_id': 1121,
             'min': 636.0, 'max': 934.0, 'median': '675.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '675.1'}
        ],
        '3b7fc925aeedffaecd8344b52e551c36833ee426': [
            {'std': '54.2', 'result_set_id': 11, 'job_id': 1121,
             'min': 2876.0, 'max': 3022.0, 'median': '2932.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '2932.4'}
        ],
        '824dbda856e33a97a85213c1e02f39b7e31103f1': [
            {'std': '43.8', 'result_set_id': 11, 'job_id': 1121,
             'min': 1879.0, 'max': 1976.0, 'median': '1916.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '1916.4'}
        ],
        '619479c35f8dd4bb2dff79a22e02b6577824e5a3': [
            {'std': '196.6', 'result_set_id': 11, 'job_id': 1121,
             'min': 38627.0, 'max': 38720.0, 'median': '38660.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '38660.2'}
        ],
        '191dc90def70a5bcf6024392e33794e109240e41': [
            {'std': '115.2', 'result_set_id': 11, 'job_id': 1121,
             'min': 13163.0, 'max': 13571.0, 'median': '13274.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '13273.8'}
        ],
        '63044a1201d428b519ae82131b6bd1892493d19b': [
            {'std': '202.2', 'result_set_id': 11, 'job_id': 1121,
             'min': 40726.0, 'max': 41059.0, 'median': '40881.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '40880.9'}
        ],
        '69a1cb436d2e96f7da12171da96ed32ac90e013c': [
            {'std': '89.8', 'result_set_id': 11, 'job_id': 1121,
             'min': 8000.0, 'max': 8235.0, 'median': '8056.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '8055.9'}
        ],
        '325a288c74ee5f59853e31ee6461dd804d09572e': [
            {'std': '115.2', 'result_set_id': 11, 'job_id': 1121,
             'min': 13129.0, 'max': 13557.0, 'median': '13267.000000',
             'total_replicates': 10, 'push_timestamp': 1402944547,
             'mean': '13266.5'}
        ]}

    def handle(self, *args, **options):

        show_default_data = options.get('show_default_data', None)
        result_set_id = options.get('result_set_id', None)
        push_timestamp = options.get('push_timestamp', None)

        if show_default_data:
            print json.dumps(self.default_data)
            sys.exit()

        if result_set_id or push_timestamp:
            for sig in self.default_data:
                if result_set_id:
                    self.default_data[sig][0]['result_set_id'] = result_set_id
                if push_timestamp:
                    self.default_data[sig][0]['push_timestamp'] = push_timestamp

        project = options.get('project')
        populate_performance_series(project, 'talos_data', self.default_data)
