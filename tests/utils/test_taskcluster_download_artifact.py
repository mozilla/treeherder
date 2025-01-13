import pytest
import responses
from requests.models import Response

from treeherder.utils.taskcluster import download_artifact


@responses.activate
@pytest.mark.parametrize(
    "path, response_config, expected_result",
    [
        [
            "my_file.json",
            {"json": {"key": "value"}, "content_type": "application/json"},
            {"key": "value"},
        ],
        [
            "my_file.yml",
            {"body": "key:\n  - value1\n  - value2", "content_type": "text/plain"},
            {"key": ["value1", "value2"]},
        ],
        [
            "my_file.txt",
            {"body": "some text from a file", "content_type": "text/plain"},
            "some text from a file",
        ],
    ],
)
def test_download_artifact(path, response_config, expected_result):
    root_url = "https://taskcluster.net"
    task_id = "A35mWTRuQmyj88yMnIF0fA"

    responses.add(
        responses.GET,
        f"{root_url}/api/queue/v1/task/{task_id}/artifacts/{path}",
        **response_config,
        status=200,
    )

    result = download_artifact(root_url, task_id, path)
    if isinstance(result, Response):
        assert result.text == expected_result
    else:
        assert result == expected_result
