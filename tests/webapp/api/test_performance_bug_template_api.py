import pytest
from django.urls import reverse

from treeherder.perf.models import PerformanceBugTemplate, PerformanceFramework

pytestmark = pytest.mark.perf


def test_perf_bug_template_api(client, test_perf_framework):
    framework2 = PerformanceFramework.objects.create(name="test_talos2", enabled=True)

    template_dicts = []
    for framework, i in zip((test_perf_framework, framework2), range(2)):
        dict = {
            "keywords": f"keyword{i}",
            "status_whiteboard": f"sw{i}",
            "default_component": f"dfcom{i}",
            "default_product": f"dfprod{i}",
            "cc_list": f"foo{i}@bar.com",
            "text": f"my great text {i}",
            "critical_text": f"my great critical text {i}",
            "no_action_required_text": f"my great text - no action is required from the author {i}",
        }
        PerformanceBugTemplate.objects.create(framework=framework, **dict)
        dict["framework"] = framework.id
        template_dicts.append(dict)

    # test that we can get them all
    resp = client.get(reverse("performance-bug-template-list"))
    assert resp.status_code == 200
    assert resp.json() == template_dicts

    # test that we can get just one (the usual case, probably)
    resp = client.get(
        reverse("performance-bug-template-list") + f"?framework={test_perf_framework.id}"
    )
    assert resp.status_code == 200
    assert resp.json() == [template_dicts[0]]
