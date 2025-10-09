import requests
from django.conf import settings


class BugManager:
    """Files bugs, and comments on them for alerts."""

    def __init__(self):
        self.bz_url = settings.BUGFILER_API_URL + "/rest/bug"
        self.bz_headers = {"Accept": "application/json"}

    def _get_default_bug_creation_data(self):
        return {
            "summary": "",
            "type": "defect",
            "product": "",
            "component": "",
            "keywords": "",
            "whiteboard": None,
            "regressed_by": None,
            "see_also": None,
            "version": None,
            "severity": "",
            "priority": "",
            "description": "",
        }

    def _get_default_bug_comment_data(self):
        return {"comment": {"body": ""}}

    def _add_needinfo(self, bugzilla_email, bug_data):
        bug_data.setdefault("flags", []).append(
            {
                "name": "needinfo",
                "status": "?",
                "requestee": bugzilla_email,
            }
        )

    def _create(self, bug_data):
        """Create a new bug.

        See `_get_default_bug_creation_data` for an example of what the
        `bug_data` should be.
        """
        headers = self.bz_headers
        headers["x-bugzilla-api-key"] = settings.BUGFILER_API_KEY

        resp = requests.post(
            url=self.bz_url,
            json=bug_data,
            headers=headers,
            verify=True,
            timeout=30,
        )
        resp.raise_for_status()

        return resp.json()

    def _modify(self, bug, changes):
        """Add a comment, or modify a bug.

        See `_get_default_bug_comment_data` for what the `bug_data`
        should be.
        """
        modification_url = self.bz_url + f"/{bug}"
        headers = self.bz_headers
        headers["x-bugzilla-api-key"] = settings.COMMENTER_API_KEY
        headers["User-Agent"] = f"treeherder/{settings.SITE_HOSTNAME}"

        resp = requests.put(
            url=modification_url,
            json=changes,
            headers=headers,
            verify=True,
            timeout=30,
        )
        resp.raise_for_status()

        return resp.json()

    def file_bug(self, *args, **kwargs):
        raise NotImplementedError()

    def modify_bug(self, *args, **kwargs):
        raise NotImplementedError()

    def comment_bug(self, *args, **kwargs):
        raise NotImplementedError()
