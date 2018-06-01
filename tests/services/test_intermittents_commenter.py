
import responses

from treeherder.services.intermittents_commenter.commenter import (TRIAGE_PARAMS,
                                                                   Commenter)


@responses.activate
def test_intermittents_commenter(bug_data):
    weekly_mode = True
    test_mode = True
    startday = '2012-05-09'
    endday = '2018-05-10'
    alt_startday = startday
    alt_endday = endday

    process = Commenter(weekly_mode, test_mode)
    comment_params = process.create_comments(startday, endday, alt_startday, alt_endday)
    url = process.create_url(bug_data['bug_id']) + '?include_fields={}'.format(TRIAGE_PARAMS['include_fields'])

    content = {
        "bugs": [
            {
                "component": "General",
                "priority": "P3",
                "product": "Testing",
                "whiteboard": "[stockwell infra] [see summary at comment 92]"
            }
        ],
        "faults": []
    }

    responses.add(responses.Response(
                    method='GET',
                    url=url,
                    json=content,
                    match_querystring=True,
                    status=200))

    with open('tests/services/expected_comment.text', 'r') as comment:
        expected_comment = comment.read()

    assert comment_params[0]['comment']['body'] == expected_comment
