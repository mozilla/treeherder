import responses

from treeherder.intermittents_commenter.commenter import Commenter
from treeherder.intermittents_commenter.constants import TRIAGE_PARAMS


@responses.activate
def test_intermittents_commenter(bug_data):
    startday = '2012-05-09'
    endday = '2018-05-10'
    alt_startday = startday
    alt_endday = endday

    process = Commenter(weekly_mode=True, dry_run=True)
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

    with open('tests/intermittents_commenter/expected_comment.text', 'r') as comment:
        expected_comment = comment.read()

    assert comment_params[0]['comment']['body'] == expected_comment
