import difflib
import pprint


def diff_dict(d1, d2):
    """Compare two dicts, the same way unittest.assertDictEqual does"""
    diff = ('\n' + '\n'.join(difflib.ndiff(
            pprint.pformat(d1).splitlines(),
            pprint.pformat(d2).splitlines())))
    return diff


