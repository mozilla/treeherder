from django.core.urlresolvers import reverse

from treeherder.perf.models import (PerformanceBugTemplate,
                                    PerformanceFramework)


def test_perf_bug_template_api(webapp, test_perf_framework):
    framework2 = PerformanceFramework.objects.create(name='test_talos2')

    template_dicts = []
    for (framework, i) in zip((test_perf_framework, framework2), range(2)):
        dict = {
            'keywords': "keyword{}".format(i),
            'status_whiteboard': "sw{}".format(i),
            'default_component': "dfcom{}".format(i),
            'default_product': "dfprod{}".format(i),
            'cc_list': "foo{}@bar.com".format(i),
            'text': "my great text {}".format(i)
        }
        PerformanceBugTemplate.objects.create(framework=framework, **dict)
        dict['framework'] = framework.id
        template_dicts.append(dict)

    # test that we can get them all
    resp = webapp.get(reverse('performance-bug-template-list'))
    assert resp.status_int == 200
    assert resp.json == template_dicts

    # test that we can get just one (the usual case, probably)
    resp = webapp.get(reverse('performance-bug-template-list') +
                      '?framework={}'.format(test_perf_framework.id))
    assert resp.status_int == 200
    assert resp.json == [template_dicts[0]]
