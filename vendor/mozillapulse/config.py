class PulseConfiguration:

    def __init__(self, **kwargs):

        # Default values for Mozilla pulse
        defaults = {
            # Connection defaults
            'user':       'public',
            'password':   'public',
            'host':       'pulse.mozilla.org',
            'port':       5672,
            'vhost':      '/',
            # Message defaults
            'serializer': 'json',
            'broker_timezone': 'US/Pacific',
        }

        # Set any vaiables passed in
        for key in kwargs:
            setattr(self, key, kwargs[key])

        # Set defaults for anything that isn't passed in
        for key in defaults:
            try:
                tmp = getattr(self, key)
            except AttributeError:
                setattr(self, key, defaults[key])
