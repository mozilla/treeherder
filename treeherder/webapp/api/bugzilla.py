from time import time

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.derived.jobs import JobDataIntegrityError
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         with_jobs)
from rest_framework.decorators import (detail_route,
                                       list_route)


class BugzillaViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    @list_route
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        params = request.data


        try:

            # call bugzilla to create the new bug


            # return the new bug number



        except JobDataIntegrityError as e:
            if e.message[0] == 1062 or "Duplicate" in e.message[1]:
                return Response(
                    {"message": "Bug job map skipped: {0}".format(e.message)},
                    200
                )
            else:
                raise e

        return Response({"message": "Bug job map saved"})


def send_request(self):        """
        Post the bug comment to Bugzilla's REST API.
        """
        if not self.body:
            self.generate_request_body()
        bz_comment_endpoint = "/rest/bug/%s/comment" % self.bug_id
        api_url = "".join([settings.BZ_API_URL, bz_comment_endpoint])
        credentials = {'login': settings.TBPLBOT_EMAIL, 'password': settings.TBPLBOT_PASSWORD}
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        logger.info("Sending data to %s: %s", api_url, self.body)
        r = requests.post(api_url, params=credentials, data=json.dumps(self.body), headers=headers, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        try:
            r.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.error("HTTPError %s submitting to %s: %s", r.status_code, api_url, r.text)
            raise