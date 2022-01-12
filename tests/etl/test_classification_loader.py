import datetime

from requests.models import HTTPError
import pytest
import responses

from treeherder.etl.classification_loader import ClassificationLoader
from treeherder.model.models import MozciClassification, Push, Repository, RepositoryGroup

DEFAULT_GTD_CONFIG = {
    'json': {
        'routes': ['index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA']
    },
    'content_type': 'application/json',
    'status': 200,
}
DEFAULT_DA_CONFIG = {
    'json': {
        'push': {
            'id': 'autoland/c73bcc465e0c2bce7debb0a86277e2dcb27444e4',
            'classification': 'GOOD',
        }
    },
    'content_type': 'application/json',
    'status': 200,
}


@pytest.fixture
def autoland_repository():
    group = RepositoryGroup.objects.create(name="development")

    return Repository.objects.create(
        dvcs_type="hg",
        name="autoland",
        url="https://hg.mozilla.org/integration/autoland",
        active_status="active",
        codebase="gecko",
        repository_group=group,
        performance_alerts_enabled=True,
        expire_performance_data=False,
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )


@pytest.fixture
def autoland_push(autoland_repository):
    return Push.objects.create(
        repository=autoland_repository,
        revision='A35mWTRuQmyj88yMnIF0fA',
        author='foo@bar.com',
        time=datetime.datetime.now(),
    )


@pytest.mark.parametrize(
    'route',
    [
        'completely bad route',
        'index.project.mozci.classification..revision.A35mWTRuQmyj88yMnIF0fA',
        'index.project.mozci.classification.autoland.revision.',
        'index.project.mozci.classification.autoland.revision.-35mW@RuQ__j88yénIF0f-',
    ],
)
def test_get_push_wrong_route(route):
    with pytest.raises(AttributeError):
        ClassificationLoader().get_push(route)


@pytest.mark.django_db
def test_get_push_unsupported_project():
    route = "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA"

    with pytest.raises(Repository.DoesNotExist) as e:
        ClassificationLoader().get_push(route)

    assert str(e.value) == 'Repository matching query does not exist.'


@pytest.mark.django_db
def test_get_push_unsupported_revision(autoland_repository):
    route = "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA"

    with pytest.raises(Push.DoesNotExist) as e:
        ClassificationLoader().get_push(route)

    assert str(e.value) == 'Push matching query does not exist.'


@pytest.mark.django_db
def test_get_push(autoland_push):
    route = "index.project.mozci.classification.autoland.revision.A35mWTRuQmyj88yMnIF0fA"

    assert ClassificationLoader().get_push(route) == autoland_push


def update_dict(dict, update):
    dict.update(update)
    return dict


@responses.activate
@pytest.mark.django_db
@pytest.mark.parametrize(
    'error_type, error_message, get_task_definition_config, get_push_error, download_artifact_config',
    [
        [HTTPError, '', {'status': 500}, None, DEFAULT_DA_CONFIG],
        [
            AssertionError,
            'A route containing the push project and revision is needed to save the mozci classification',
            update_dict({**DEFAULT_GTD_CONFIG}, {'json': {}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [
            AssertionError,
            'A route containing the push project and revision is needed to save the mozci classification',
            update_dict({**DEFAULT_GTD_CONFIG}, {'json': {'routes': []}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [
            AttributeError,
            None,
            update_dict({**DEFAULT_GTD_CONFIG}, {'json': {'routes': ['bad route']}}),
            None,
            DEFAULT_DA_CONFIG,
        ],
        [None, None, DEFAULT_GTD_CONFIG, Repository.DoesNotExist, DEFAULT_DA_CONFIG],
        [
            Push.DoesNotExist,
            'Push matching query does not exist.',
            DEFAULT_GTD_CONFIG,
            Push.DoesNotExist,
            DEFAULT_DA_CONFIG,
        ],
        [HTTPError, '', DEFAULT_GTD_CONFIG, None, {'status': 500}],
        [
            AssertionError,
            'Classification result should be a value in BAD, GOOD, UNKNOWN',
            DEFAULT_GTD_CONFIG,
            None,
            update_dict(
                {**DEFAULT_DA_CONFIG},
                {
                    'json': {
                        'push': {
                            'id': 'autoland/c73bcc465e0c2bce7debb0a86277e2dcb27444e4',
                            'classification': 'WRONG',
                        }
                    }
                },
            ),
        ],
    ],
)
def test_process_handle_errors(
    monkeypatch,
    autoland_push,
    error_type,
    error_message,
    get_task_definition_config,
    get_push_error,
    download_artifact_config,
):
    root_url = 'https://community-tc.services.mozilla.com'
    task_id = 'A35mWTRuQmyj88yMnIF0fA'

    responses.add(
        responses.GET,
        f'{root_url}/api/queue/v1/task/{task_id}',
        **get_task_definition_config,
    )
    responses.add(
        responses.GET,
        f'{root_url}/api/queue/v1/task/{task_id}/artifacts/public/classification.json',
        **download_artifact_config,
    )

    if get_push_error:

        def mock_get_push(x, y):
            raise get_push_error(error_message)

        monkeypatch.setattr(ClassificationLoader, 'get_push', mock_get_push)

    assert MozciClassification.objects.count() == 0

    if error_type:
        with pytest.raises(error_type) as e:
            ClassificationLoader().process({'status': {'taskId': task_id}}, root_url)
        if error_message:
            assert str(e.value) == error_message
    else:
        ClassificationLoader().process({'status': {'taskId': task_id}}, root_url)

    assert MozciClassification.objects.count() == 0


@responses.activate
@pytest.mark.django_db
def test_process(autoland_push):
    root_url = 'https://community-tc.services.mozilla.com'
    task_id = 'A35mWTRuQmyj88yMnIF0fA'

    responses.add(responses.GET, f'{root_url}/api/queue/v1/task/{task_id}', **DEFAULT_GTD_CONFIG)
    responses.add(
        responses.GET,
        f'{root_url}/api/queue/v1/task/{task_id}/artifacts/public/classification.json',
        **DEFAULT_DA_CONFIG,
    )

    assert MozciClassification.objects.count() == 0

    ClassificationLoader().process({'status': {'taskId': task_id}}, root_url)

    assert MozciClassification.objects.count() == 1
    classification = MozciClassification.objects.first()
    assert classification.push == autoland_push
    assert classification.result == MozciClassification.GOOD
    assert classification.task_id == task_id
