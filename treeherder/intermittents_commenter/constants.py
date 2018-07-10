import logging

from django.conf import settings

logger = logging.getLogger(__name__)
TREEHERDER_USER_AGENT = 'treeherder/{}'.format(settings.SITE_HOSTNAME)
REQUESTS_TIMEOUT = 30

# Min required failures per bug in order to post a comment
MIN_DAILY_THRESHOLD = 15
MIN_WEEKLY_THRESHOLD = 1
TOP_BUGS_THRESHOLD = 50

# Includes call-to-action message for priority threshold bugs
PRIORITY1_THRESHOLD = 75
PRIORITY2_THRESHOLD = 30

DISABLE_THRESHOLD = 150
DISABLE_DAYS = 21

# Change [stockwell needswork] to [stockwell unknown] when failure rate
# drops below 20 failures/week
UNKNOWN_THRESHOLD = 20

WHITEBOARD_DISABLE_RECOMMENDED = '[stockwell disable-recommended]'
WHITEBOARD_NEEDSWORK_OWNER = '[stockwell needswork:owner]'
WHITEBOARD_NEEDSWORK = '[stockwell needswork]'
WHITEBOARD_UNKNOWN = '[stockwell unknown]'

TRIAGE_PARAMS = {'include_fields': 'product, component, priority, whiteboard'}

COMPONENTS = [
  ['Core', 'Canvas: 2D'],
  ['Core', 'Canvas: WebGL'],
  ['Core', 'DOM'],
  ['Core', 'DOM: Core & HTML'],
  ['Core', 'DOM: Device Interfaces'],
  ['Core', 'DOM: Events'],
  ['Core', 'DOM: IndexedDB'],
  ['Core', 'DOM: Push Notifications'],
  ['Core', 'DOM: Quota Manager'],
  ['Core', 'DOM: Service Workers'],
  ['Core', 'DOM: Workers'],
  ['Core', 'DOM:Content Processes'],
  ['Core', 'Document Navigation'],
  ['Core', 'Event Handling'],
  ['Core', 'GFX: Color Management'],
  ['Core', 'Graphics'],
  ['Core', 'Graphics: Layers'],
  ['Core', 'Graphics: Text'],
  ['Core', 'Graphics: WebRender'],
  ['Core', 'HTML: Form Submission'],
  ['Core', 'HTML: Parser'],
  ['Core', 'IPC'],
  ['Core', 'Image Blocking'],
  ['Core', 'ImageLib'],
  ['Core', 'Javascript Engine'],
  ['Core', 'Javascript Engine: JIT'],
  ['Core', 'Javascript: GC'],
  ['Core', 'Javascript: Internationalization API'],
  ['Core', 'Javascript: Standard Library'],
  ['Core', 'Keyboard: Navigation'],
  ['Core', 'Networking'],
  ['Core', 'Networking: Cache'],
  ['Core', 'Networking: Cookies'],
  ['Core', 'Networking: DNS'],
  ['Core', 'Networking: Domain Lists'],
  ['Core', 'Networking: FTP'],
  ['Core', 'Networking: File'],
  ['Core', 'Networking: HTTP'],
  ['Core', 'Networking: JAR'],
  ['Core', 'Networking: WebSockets'],
  ['Core', 'Plug-ins'],
  ['Core', 'Security: Sandboxing Process'],
  ['Core', 'Serializers'],
  ['Core', 'Widget'],
  ['Core', 'Widget: Win32'],
  ['Core', 'Widget: WinRT'],
  ['Core', 'XBL'],
  ['Core', 'XML'],
  ['Core', 'XPConnect'],
  ['Core', 'XSLT'],
  ['Core', 'js-ctypes'],
  ['Firefox for Android', 'Add-ons Manager'],
  ['Firefox for Android', 'Testing'],
  ['Firefox', 'Disability Access'],
  ['Firefox', 'Toolbars and Customization'],
  ['Toolkit', 'Add-ons Manager'],
  ['Toolkit', 'Reader Mode'],
  ['Toolkit', 'Toolbars and Toolbar Customization'],
  ['Toolkit', 'WebExtensions: Android'],
  ['Toolkit', 'WebExtensions: Android'],
  ['Toolkit', 'WebExtensions: Compatibility'],
  ['Toolkit', 'WebExtensions: Developer Tools'],
  ['Toolkit', 'WebExtensions: Experiments'],
  ['Toolkit', 'WebExtensions: Frontend'],
  ['Toolkit', 'WebExtensions: General'],
  ['Toolkit', 'WebExtensions: Request Handling'],
  ['Toolkit', 'WebExtensions: Untriaged']
]
