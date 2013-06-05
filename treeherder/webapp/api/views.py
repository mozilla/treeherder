import urllib

import simplejson as json
import oauth2 as oauth
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from treeherder.model.derived import JobsModel


APP_JS = 'application/json'

@csrf_exempt
def job_ingestion(request, project, guid):
    """
    Post a JSON blob of data for the specified project.

    Store the JSON in the objectstore where it will be held for
    later processing.
    """

    # default to bad request if the JSON is malformed or not present
    status = 400

    try:
        json_data = request.POST['data']
    except KeyError:
        result = {"status": "No POST data found: %s" % request.POST}
    else:
        unquoted_json_data = urllib.unquote(json_data)

        error = None

        try:
            json.loads(unquoted_json_data)
        except ValueError as e:
            error = "Malformed JSON: {0}".format(e.message)
            result = {"status": "Malformed JSON", "message": error}
        else:
            result = {
                "status": "well-formed JSON stored",
                "size": len(unquoted_json_data),
            }

        # try:
        #     jm = JobsModel.create(project)
        #     jm.store_job_data(unquoted_json_data, guid, error)
        #     jm.disconnect()
        # except Exception as e:
        #     status = 500
        #     result = {"status": "Unknown error", "message": str(e)}
        # else:
        #     if not error:
        #         status = 200
        status = 200

    return HttpResponse(json.dumps(result), mimetype=APP_JS, status=status)
