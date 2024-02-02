from django.urls import reverse

from treeherder.perf.models import PerformanceBugTemplate, PerformanceFramework


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
