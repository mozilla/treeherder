import re
from rfc3339 import rfc3339


# Takes a string and attempts to extract bug ids in it
# TODO: Make this better
def extract_bug_ids(msg):
    m = re.search(r'([0-9]{5,})', msg, re.I)     
    if m and m.groups():
        return m.groups()
    else:
        return None

# Takes a repository name as a string and breaks it into parts
# that can be the used to construct data for a routing key
# TODO: Make this better
def repo_parts(repo):
    return re.split(r'[/-]+', repo)

# Takes a datetime object and returns a normalized UTC string
# (so other/non-python clients can convert it to a native type)
def time_to_string(mydatetime):
    # RFC 3339 format
    return rfc3339(mydatetime)

# Stub for future work
def email_to_routing_key(email):
    # Should we do any processing here?
    # Should we strip out periods?
    return email
