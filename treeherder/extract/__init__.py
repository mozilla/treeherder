import os
import sys

VENDOR_PATH = __file__.replace("__init__.py", "").rstrip(os.sep)+os.sep+"vendor.zip"

if VENDOR_PATH not in sys.path:
    sys.path.insert(0, VENDOR_PATH)
    # sys.path.append(VENDOR_PATH)
