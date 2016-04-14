import ctypes
import sys
import json
import os
from ctypes import c_char_p, Structure, POINTER, c_uint32

path = os.path.split(__file__)[0]
prefix = {'win32': ''}.get(sys.platform, 'lib')
extension = {'darwin': '.dylib', 'win32': '.dll'}.get(sys.platform, '.so')
lib = ctypes.cdll.LoadLibrary(os.path.join(path, prefix + "logparser" + extension))


lib.parse_artifacts.argtypes = (c_char_p, c_char_p)
lib.parse_artifacts.restype = c_char_p

class ArtifactBuilderCollection(object):
    def __init__(self, url, user_agent="Log Parser"):
        self.url = url
        self.user_agent = user_agent
        self.artifacts = {}
        self.key_map = {
            "job_details": ("Job Info", True),
            "step_data": ("text_log_summary", True),
            "performance_data": ("performance_data", False)
        }

    def parse(self):
        data = lib.parse_artifacts(self.url, self.user_agent)

        if not data:
            return

        for artifact_str in data.split("\x17"):
            artifact = json.loads(artifact_str)
            for key in artifact.keys():
                if key in self.key_map:
                    name, required = self.key_map[key]
                    if not artifact and not required:
                        continue
                    if key == "performance_data":
                        artifact[key] = [json.loads(item) for item in artifact[key]]
                    self.artifacts[name] = artifact
