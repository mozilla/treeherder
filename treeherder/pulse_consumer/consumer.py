import json
import re
import time
import sys
import hashlib
import socket
import signal

from django.conf import settings
from multiprocessing import Process, Queue
from mozillapulse import consumers
from treeherder.pulse_consumer.daemon import Daemon

####
#
#   PLATFORMS_BUILDERNAME, BUILD_TYPE_BUILDERNAME, JOB_TYPE_BUILDERNAME
#   SOURCESTAMPS_BRANCH
#
#   http://mxr.mozilla.org/build/source/buildapi/buildapi/model/util.py
#
####
PLATFORMS_BUILDERNAME = {

    'linux-mock': {
        'regexes': [
            re.compile('^b2g .+_armv7a.+',  re.IGNORECASE),
            re.compile('^b2g linux32_gecko .+',  re.IGNORECASE),
            re.compile('^b2g_((?!(test|talos)).)+$',  re.IGNORECASE),
            re.compile('^Android (?!(?:Tegra|Armv6 Tegra|no-ionmonkey Tegra 250|4.0 Panda)).+'),
            re.compile('.*linux.*',  re.IGNORECASE),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'gecko',
            'arch': 'ARMv7',
            'vm': False
            }
        },

    'fedora': {
        'regexes': [
            re.compile('^Rev3 Fedora 12 .+'),
            re.compile('jetpack-.*-fedora(?!64)'),
            re.compile('^b2g_.+(opt|debug) test.+',  re.IGNORECASE)
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Fedora 12',
            'arch':'x86',
            'vm': False
            }
        },

    'fedora64': {
        'regexes': [
            re.compile('Rev3 Fedora 12x64 .+'),
            re.compile('jetpack-.*-fedora64'),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Fedora 12',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'ubuntu32_vm': {
        'regexes':[
            re.compile('Ubuntu VM 12.04 (?!x64).+'),
            re.compile('jetpack-.*-ubuntu32(?:_vm)?'),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu 12.04',
            'arch': 'x86',
            'vm': True
            }
        },

    'ubuntu64_vm': {
        'regexes':[
            re.compile('Ubuntu VM 12.04 x64 .+'),
            re.compile('jetpack-.*-ubuntu64(?:_vm)?'),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu VM 12.04',
            'arch': 'x86_64',
            'vm': True
            }
        },

    'ubuntu32_hw': {
        'regexes':[
            re.compile('Ubuntu HW 12.04 (?!x64).+'),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu HW 12.04',
            'arch': 'x86',
            'vm': False
            }
        },

    'ubuntu64_hw': {
        'regexes':[
            re.compile('Ubuntu HW 12.04 x64 .+'),
            ],

        'attributes': {
            'os': 'linux',
            'os_platform': 'Ubuntu HW 12.04',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'leopard': {
        'regexes':[
            re.compile('^OS X 10\.5.+'),
            re.compile('^Rev3 MacOSX Leopard 10\.5.+'),
            re.compile('.*macosx(?!64).*'),
            re.compile('jetpack-.*-leopard'),
            ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.5',
            'arch': 'x86',
            'vm': False
            }
        },

    'snowleopard': {
        'regexes':[
            re.compile('^OS X 10\.6.+'),
            re.compile('^Rev3 MacOSX Snow Leopard 10\.6.+'),
            re.compile('.*macosx64.*'),
            re.compile('jetpack-.*-snowleopard'),
            ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'snowleopard-r4': {
        'regexes':[
            re.compile('^Rev4 MacOSX Snow Leopard 10\.6.+'),
            ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'lion': {
        'regexes':[
            re.compile('^OS X 10\.7.+'),
            re.compile('^Rev4 MacOSX Lion 10\.7.+'),
            re.compile('jetpack-.*-lion'),
            ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.6',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'mountainlion': {
        'regexes':[
            re.compile('^Rev5 MacOSX Mountain Lion 10\.8+'),
            re.compile('jetpack-.*-mountainlion'),
            ],

        'attributes': {
            'os': 'mac',
            'os_platform': 'OS X 10.8',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'xp': {
        'regexes':[
            re.compile('^Rev3 WINNT 5\.1 .+'),
            re.compile('jetpack-.*-xp'),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 5.1',
            'arch': 'x86',
            'vm': False
            }
        },

    'win2k3': {
        'regexes':[
            re.compile('^WINNT 5\.2 .+'),
            re.compile('.*win32.*'),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 5.2',
            'arch': 'x86',
            'vm': False
            }
        },

    'win64': {
        'regexes':[
            re.compile('^WINNT 6\.1 .+'),
            re.compile('.*win64.*'),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'win7': {
        'regexes':[
            re.compile('^Rev3 WINNT 6\.1 '),
            re.compile('jetpack-.*-win7'),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'Rev3 WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'win764': {
        'regexes':[
            re.compile('^Rev3 WINNT 6\.1 x64 .+'),
            re.compile('jetpack-.*-w764'),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'Rev3 WINNT 6.1',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'win8': {
        'regexes':[
            re.compile('.*WINNT 6\.2 '),
            ],

        'attributes': {
            'os': 'win',
            'os_platform': 'WINNT 6.3',
            'arch': 'x86_64',
            'vm': False
            }
        },

    'tegra': {
        'regexes':[
            re.compile('^Android Tegra 250 .+'),
            re.compile('^Android Armv6 Tegra 250 .+'),
            re.compile('^Android no-ionmonkey Tegra 250 .+'),
            ],

        'attributes': {
            'os': 'android',
            'os_platform': '2.2',
            'arch': 'ARMv7',
            'vm': False
            }
        },

    'panda-android': {
        'regexes':[
            re.compile('^Android 4.0 Panda .+'),
            ],

        'attributes': {
            'os': 'android',
            'os_platform': '4.0',
            'arch': 'x86',
            'vm': False
            }
    }
}

BUILD_TYPE_BUILDERNAME = {
    'opt': [
        re.compile('.+ opt .+'),
        re.compile('.+(?<!leak test) build'),
        re.compile('.+ talos .+'),          # all talos are made only for opt
        re.compile('.+ nightly$'),          # all nightly builds are opt
        re.compile('.+ xulrunner$'),        # nightly
        re.compile('.+ code coverage$'),    # nightly
    ],
    'debug': [
        re.compile('.+ debug .+'),
        re.compile('.+ leak test build'),
    ],
}

JOB_TYPE_BUILDERNAME = {
    'build': [
        re.compile('.+ build'),
        re.compile('.+(?<!l10n) nightly$'),     # all 'nightly'-s are builds
        re.compile('.+ xulrunner$'),            # nightly
        re.compile('.+ code coverage$'),        # nightly
    ],
    'unittest': [re.compile('.+(?<!leak) test .+')],
    'talos': [re.compile('.+ talos .+')],
    'repack': [re.compile('.+ l10n .+')],
}

class PulseDataAdapter(object):

    def __init__(
        self, rawdata=None, outfile=None, durable=False,
        context='dataadapter', logdir='logs'):

        self.data = {}
        self.logdir = logdir
        self.context = context
        self.durable = durable
        self.rawdata = rawdata

        #Set the output stream to write to
        self.outstream = None

        if outfile:
            if outfile == 'stdout':
                outfile = sys.stdout
            else:
                outfile = open(outfile, 'w')

            self.outstream = outfile

        #Setup signal handler
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

        """
            data_attributes description

            key - set of '.' delimited keys in the raw pulse stream

                processor - function reference called with the data
                            structure specified in the key.

                            Ex: processor(attr_table, pulse_data, data)

                attr_table - List of attributes to process in the data
                            structure specified by the key.

                    attr -  The attribute name in the raw pulse stream.

                    attr_test - A list of strings to match against the
                                attribute in the raw pulse stream.

                    cb - function reference that's called instead of
                         executing the default behavior. Use this when
                         special processing of the raw data for an attribute
                         is required.

                         Ex: cb(attr, pulse_value, data)
        """
        self.data_attributes = {

                '_meta': {
                    'processor':self.process_raw_data_dict,
                    'attr_table':[
                            { 'attr':'routing_key',
                              'cb':self.get_routing_key_data
                                }
                        ]
                    },
                'payload.build': {
                    'processor':self.process_raw_data_dict,
                    'attr_table':[
                        { 'attr':'results' },
                        { 'attr':'slave' },
                        { 'attr':'blame' },
                        { 'attr':'reason' },
                        ]
                    },
                'payload.build.sourceStamp.changes': {
                    'processor':self.process_sourcestamp_changes_list,
                    'attr_table':[
                        { 'attr':'who' },
                        { 'attr':'when' },
                        ]
                    },
                'payload.build.properties': {
                    'processor':self.process_property_list,
                    'attr_table':[
                        { 'attr':'revision' },
                        { 'attr':'product' },
                        { 'attr':'branch' },
                        { 'attr':'platform' },
                        { 'attr':'buildid' },
                        { 'attr':'log_url' },
                        { 'attr':'buildername',
                            'cb':self.get_buildername_data
                            },
                        { 'attr':'slavename' },
                        { 'attr':'request_ids' },
                        { 'attr':'request_times' },
                        {
                          'attr':'buildurl',
                          'attr_test':['packageUrl', 'build_url', 'fileURL']
                            },
                        ],
                    }
            }

        #Build list of required attributes for data validation
        self.required_attributes = set(
            #These are attributes set outside of the attr_table's in
            #self.data_attributes
            [ 'os', 'os_platform', 'arch', 'vm', 'buildtype', 'test_name' ]
            )

        for key in self.data_attributes:
            for attr_dict in self.data_attributes[key]['attr_table']:
                self.required_attributes.add(attr_dict['attr'])

        #
        # TODO: This list of routing key strings were excluded from
        #       processing in the current PulseBuildbotTranslator. Confirm
        #       if we need to exclude any of these and then use or remove
        #self.exclude_routing_key_regex = re.compile(
        #    r'[schedulers|tag|submitter|final_verification|fuzzer|source|repack|jetpack|finished]'
        #    )

        #set pulse consumer labels
        app_label_base = 'pulse-{0}-consumer-{1}-{2}'

        self.buildapp_label = app_label_base.format(
            'build', self.context, socket.gethostname()
            )

        #initialize consumers
        self.pulse = consumers.BuildConsumer(
            applabel=self.buildapp_label
            )

        #configure consumers
        self.pulse.configure(
            topic=['#.finished', '#.log_uploaded'],
            callback=self.process_data,
            durable=self.durable
            )

    def start(self):

        self.pulse.listen()

    def signal_handler(self, signal, frame):

        #close outstream if we have one
        if self.outstream:
            self.outstream.close()

        sys.exit(0)

    def process_data(self, raw_data, message):
        """Process the raw data from the pulse stream using the
           processor and attributes specified in the data_attributes
           structure."""

        message.ack()

        data = {}

        for attr_key in self.data_attributes:

            #retrieve raw_data reference by the attr_key
            pulse_data_target = self._get_data(attr_key, raw_data)

            #call the data processor
            self.data_attributes[attr_key]['processor'](
                self.data_attributes[attr_key]['attr_table'],
                pulse_data_target, data
                )

        #Validate data
        missing_attributes = self.required_attributes.difference(
            set( data.keys() )
            )

        if missing_attributes:

            #raise PulseMissingAttributesError(
            #    missing_attributes, data, raw_data
            #    )
            pass
        else:
            #Carry out data processing that requires all of the
            #attributes being populated
            data = self.adapt_data(data)

            if self.outstream:
                self.outstream.write(str(data) + "\n")
                self.outstream.flush()

                if self.rawdata:
                    self.outstream.write(str(raw_data) + "\n")
                    self.outstream.flush()

        return data

    def process_raw_data_dict(self, attr_table, pulse_data, data):
        """Process a pulse stream dictionary"""

        for attr_data in attr_table:

            attr = attr_data.get('attr', None)
            cb = attr_data.get('cb', None)

            pulse_value = pulse_data.get(attr, None)

            if cb:
                cb(attr, pulse_value, data)
            else:
                if (type( pulse_value ) == list) and (len(pulse_value) > 0):
                    data[attr] = pulse_value[0]
                else:
                    data[attr] = pulse_value

    def process_property_list(self, attr_table, pulse_data, data):
        """Process the pulse stream property list"""

        for datum in pulse_data:

            for attr_data in attr_table:

                attr = attr_data.get('attr', None)
                attr_test = attr_data.get('attr_test', None)

                if ( attr_test and (datum[0] in attr_test) ) or ( attr and (attr in datum[0]) ):

                    cb = attr_data.get('cb', None)

                    if cb:
                        cb(datum[0], datum[1], data)
                    else:
                        data[attr] = datum[1]

    def process_sourcestamp_changes_list(self, attr_table, pulse_data, data):
        """Process sourcestamp changes list"""
        if (type( pulse_data ) == list) and (len(pulse_data) > 0):
            self.process_raw_data_dict(attr_table, pulse_data[0], data)

    def adapt_data(self, data):
        """Execute any required post processing steps and return the
           updated data structure. This is an interface function for 
           derived classes to use to adapt the data in different ways."""
        return JobData(data)

    def get_buildername_data(self, attr, value, data):

        #set buildername
        data[attr] = value

        #extend data with platform attributes
        for platform_name in PLATFORMS_BUILDERNAME:
            for regex in PLATFORMS_BUILDERNAME[platform_name]['regexes']:
                if regex.search(value):
                    data.update(
                        PLATFORMS_BUILDERNAME[platform_name]['attributes']
                        )
                    data['platform_name'] = platform_name

                    break

        #extend data with with build type attributes
        for build_type in BUILD_TYPE_BUILDERNAME:
            for regex in BUILD_TYPE_BUILDERNAME[build_type]:
                if regex.search(value):
                    data['buildtype'] = build_type

                    break

        if 'buildtype' not in data:
            data['buildtype'] = 'opt'

        #extend data with job type data
        for job_type in JOB_TYPE_BUILDERNAME:
            for regex in JOB_TYPE_BUILDERNAME[job_type]:
                if regex.search(value):
                    data['jobtype'] = job_type
                    break

        buildername_fields = value.split()

        data['test_name'] = buildername_fields[ len( buildername_fields ) - 1 ]

    def get_routing_key_data(self, attr, value, data):

        #set buildername
        data[attr] = value

    def _get_data(self, attribute_key, raw_data):
        """Uses the attribute key to return the target data structure
           in raw data. The attribute key should be a set of strings
           delimited by '.'s, where each string is an entry in the raw
           data dict provided."""
        fields = attribute_key.split('.')
        target_struct = None

        for idx, f in enumerate(fields):
            try:
                if idx == 0:
                    target_struct = raw_data[f]
                else:
                    target_struct = target_struct[f]
            except KeyError:
                msg = "In {0} not found in pulse data.".format(attribute_key)
                raise PulseDataAttributeError(f, msg)

        return target_struct

    def _process_platform_data(self, data):

        if not data['platform']:
            if data['stage_platform']:
                data['platform'] = data['stage_platform']
            else:
                pass

class TreeherderDataAdapter(PulseDataAdapter):

    def __init__(self, **kwargs):

        super(TreeherderDataAdapter, self).__init__(**kwargs)

    def get_revision_hash(self, revisions):

        sh = hashlib.sha1()
        sh.update(
            ''.join( map( lambda x: str(x), revisions ) )
            )

        return sh.hexdigest()

    def get_job_guid(self, request_ids, request_times):

        sh = hashlib.sha1()

        sh.update(
            ''.join( map( lambda x: str(x), request_ids ) )
            )
        sh.update(
            ''.join( map( lambda x: str(x), request_times ) )
            )

        return sh.hexdigest()

    def adapt_data(self, data):

        treeherder_data = {
            'sources': { },
            #Include branch so revision hash with the same revision is still
            #unique across branches
            'revision_hash': self.get_revision_hash(
                [ data['revision'], data['branch'] ]
                ),
            'jobs': []
            }

        treeherder_data['sources'][ data['branch'] ] = data['revision']

        job = {
            'job_guid': self.get_job_guid(
                data['request_ids'], data['request_times']
                ),
            'name':data['test_name'],
            'product_name':data['product'],
            'state':'TODO',

            #Do we need to map this to the strings in the sample structure?
            'result':data['results'],
            'reason':data['reason'],

            #There is both a who and blame that appear to be identical in the
            #pulse stream, is who the way to go?
            'who':data['who'],

            #Need to confirm 'when' is the correct pulse attribute
            'submit_timestamp': data['when'],
            'start_timestamp': data['buildid'],

            #where do we find this, is it when the routing key has
            #'.finished' in it? For now populate with time()
            'end_timestamp': str( time.time() ).split('.')[0],
            'machine': data['slave'],

            'build_platform': {
                'os_name': data['os'],
                'platform': data['os_platform'],
                'architecture': data['arch'],
                'vm': data['vm']
                },
            #where are we going to get this data from?
            'machine_platform': {
                'os_name': data['os'],
                'platform': data['os_platform'],
                'architecture': data['arch'],
                'vm': data['vm']
                },

            'option_collection': {
                data['buildtype']:True
                },
            'log_references':[
                { 'url':data['log_url'],
                  #Do we need this?
                  'name':data['jobtype']
                    },
                ],

            'artifact':{}
            }

        treeherder_data['jobs'].append(job)

        return JobData(treeherder_data)

class PulseMessageError(Exception):
    def __init__(self, key, error):
        self.key = key
        self.error = error
    def __str__(self):
        return "%s, key: %s" % (self.error, self.key)

class PulseDataAttributeError(PulseMessageError): pass

class PulseMissingAttributesError(PulseMessageError):

    def __init__(self, missing_attributes, data, raw_data):

        self.missing_attributes = missing_attributes
        self.data = data
        self.raw_data = raw_data

    def __str__(self):

        msg = "The following attributes were not found: {0} in routing_key:{1}\nbuildername:{2}\n{3}\n{4}".format(
            ','.join(self.missing_attributes), self.data['routing_key'],
            self.data['buildername'], self.data, self.raw_data
            )

        return msg

class JobDataError(ValueError): pass

class JobData(dict):
    """
    Encapsulates data access from incoming test data structure.

    All missing-data errors raise ``JobDataError`` with a useful
    message. Unlike regular nested dictionaries, ``JobData`` keeps track of
    context, so errors contain not only the name of the immediately-missing
    key, but the full parent-key context as well.
    """
    def __init__(self, data, context=None):
        """Initialize ``JobData`` with a data dict and a context list."""
        self.context = context or []
        super(JobData, self).__init__(data)

    @classmethod
    def from_json(cls, json_blob):
        """Create ``JobData`` from a JSON string."""
        try:
            data = json.loads(json_blob)
        except ValueError as e:
            raise JobDataError("Malformed JSON: {0}".format(e))
        return cls(data)

    def __getitem__(self, name):
        """Get a data value, raising ``JobDataError`` if missing."""
        full_context = list(self.context) + [name]

        try:
            value = super(JobData, self).__getitem__(name)
        except KeyError:
            raise JobDataError("Missing data: {0}.".format(
                "".join(["['{0}']".format(c) for c in full_context])))

        # Provide the same behavior recursively to nested dictionaries.
        if isinstance(value, dict):
            value = self.__class__(value, full_context)

        return value

class TreeherderPulseDaemon(Daemon):

    def __init__(
        self,
        pidfile,
        treeherder_data_adapter=TreeherderDataAdapter(
            durable=False,
            logdir='logs',
            rawdata=False,
            outfile=None
            ),
        stdin='/dev/null',
        stdout='/dev/null',
        stderr='/dev/null'):

        self.tda = treeherder_data_adapter

        super(TreeherderPulseDaemon, self).__init__(
            pidfile, stdin='/dev/null', stdout='/dev/null',
            stderr='/dev/null')

    def run(self):

        self.tda.start()

