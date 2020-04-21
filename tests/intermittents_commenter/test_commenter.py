import responses
from django.conf import settings

from treeherder.intermittents_commenter.commenter import Commenter


@responses.activate
def test_intermittents_commenter(bug_data):
    startday = '2012-05-09'
    endday = '2018-05-10'
    alt_startday = startday
    alt_endday = endday

    process = Commenter(weekly_mode=True, dry_run=True)
    params = {'include_fields': 'product%2C+component%2C+priority%2C+whiteboard%2C+id'}
    url = '{}/rest/bug?id={}&include_fields={}'.format(
        settings.BZ_API_URL, bug_data['bug_id'], params['include_fields']
    )

    content = {
        "bugs": [
            {
                u"component": u"General",
                u"priority": u"P3",
                u"product": u"Testing",
                u"whiteboard": u"[stockwell infra] [see summary at comment 92]",
                u"id": bug_data['bug_id'],
            }
        ],
        "faults": [],
    }

    responses.add(
        responses.Response(method='GET', url=url, json=content, match_querystring=True, status=200)
    )

    resp = process.fetch_bug_details(bug_data['bug_id'])
    assert resp == content['bugs']

    comment_params = process.generate_bug_changes(startday, endday, alt_startday, alt_endday)

    with open('tests/intermittents_commenter/expected_comment.text', 'r') as comment:
        expected_comment = comment.read()

    assert comment_params[0]['changes']['comment']['body'] == expected_comment
