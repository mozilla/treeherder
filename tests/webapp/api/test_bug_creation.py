from django.urls import reverse

from treeherder.model.models import BugzillaComponent, FilesBugzillaMap

# @pytest.mark.parametrize(
#     ('offset', 'count', 'expected_num'),
#     [(None, None, 10), (None, 5, 5), (5, None, 6), (0, 5, 5), (10, 10, 1)],
# )


def test_bugzilla_components_for_path(client, test_job):
    BugzillaComponent.objects.create(product="Mock Product 1", component="Mock Component 1")

    FilesBugzillaMap.objects.create(
        path="mock/folder/file_1.extension",
        file_name="file_1.extension",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    url_base = reverse("bugzilla-component-list")

    expected_mock1 = [{"product": "Mock Product 1", "component": "Mock Component 1"}]

    resp = client.get(url_base + "?path=file_1.extension")
    assert resp.status_code == 200
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=file_2.extension")
    assert resp.json() == []

    resp = client.get(url_base + "?path=ile_2.extension")
    assert resp.json() == []

    resp = client.get(url_base + "?path=file_1")
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=mock/folder/file_1.extension")
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=other_mock/other_folder/file_1.extension")
    # Should also pass because search falls back to file name if no match for path.
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=folder/file_1.extension")
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=folder/file_1.other_extension")
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=completely.unrelated")
    assert resp.json() == []

    BugzillaComponent.objects.create(product="Mock Product 1", component="Mock Component 2")

    FilesBugzillaMap.objects.create(
        path="mock/folder_2/file_1.extension",
        file_name="file_1.extension",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    expected_mock2 = [{"product": "Mock Product 1", "component": "Mock Component 2"}]

    expected_mock1_mock2 = [
        {"product": "Mock Product 1", "component": "Mock Component 1"},
        {"product": "Mock Product 1", "component": "Mock Component 2"},
    ]

    resp = client.get(url_base + "?path=file_1.extension")
    assert resp.json() == expected_mock1_mock2

    resp = client.get(url_base + "?path=mock/folder/file_1.extension")
    assert resp.json() == expected_mock1

    resp = client.get(url_base + "?path=mock/folder_2/file_1.extension")
    assert resp.json() == expected_mock2

    resp = client.get(url_base + "?path=other_mock/other_folder/file_1.extension")
    # Should also pass because search falls back to file name if no match for path.
    assert resp.json() == expected_mock1_mock2

    BugzillaComponent.objects.create(product="Mock Product 3", component="Mock Component 3")

    FilesBugzillaMap.objects.create(
        path="mock_3/folder_3/other.file.js",
        file_name="other.file.js",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    expected_mock3 = [{"product": "Mock Product 3", "component": "Mock Component 3"}]

    resp = client.get(url_base + "?path=other.file.js")
    assert resp.json() == expected_mock3

    resp = client.get(url_base + "?path=other.file")
    assert resp.json() == expected_mock3

    resp = client.get(url_base + "?path=other")
    assert resp.json() == expected_mock3

    BugzillaComponent.objects.create(product="Mock Product 4", component="Mock Component 4")

    FilesBugzillaMap.objects.create(
        path="mock_3/folder_3/other.extension",
        file_name="other.extension",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    expected_mock4 = [{"product": "Mock Product 4", "component": "Mock Component 4"}]

    expected_mock3_mock4 = [
        {"product": "Mock Product 3", "component": "Mock Component 3"},
        {"product": "Mock Product 4", "component": "Mock Component 4"},
    ]

    resp = client.get(url_base + "?path=other.file.js")
    assert resp.json() == expected_mock3

    resp = client.get(url_base + "?path=other.extension")
    assert resp.json() == expected_mock4

    resp = client.get(url_base + "?path=other")
    assert resp.json() == expected_mock3_mock4

    resp = client.get(url_base + "?path=another")
    assert resp.json() == []

    BugzillaComponent.objects.create(
        product="Mock Product org.mozilla.*.<TestName>", component="Mock Component File Match"
    )

    FilesBugzillaMap.objects.create(
        path="parent/folder/org/mozilla/geckoview/test/MockTestName.kt",
        file_name="MockTestName.kt",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    BugzillaComponent.objects.create(
        product="Mock Product org.mozilla.*.<TestName>", component="Mock Component No File Match"
    )

    FilesBugzillaMap.objects.create(
        path="parent/folder/org/mozilla/geckoview/test/OtherName.kt",
        file_name="OtherName.kt",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    BugzillaComponent.objects.create(
        product="Mock Product org.mozilla.*.<TestName>",
        component="Mock Component No File Match For Subtest",
    )

    FilesBugzillaMap.objects.create(
        path="parent/folder/org/mozilla/geckoview/test/Subtest.kt",
        file_name="Subtest.kt",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    BugzillaComponent.objects.create(
        product='Mock Product with "org" file', component='Mock Component with "org" file'
    )

    FilesBugzillaMap.objects.create(
        path="other/folder/org.html",
        file_name="org.html",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    expected_mock_org_mozilla = [
        {
            "product": "Mock Product org.mozilla.*.<TestName>",
            "component": "Mock Component File Match",
        }
    ]

    resp = client.get(url_base + "?path=org.mozilla.geckoview.test.MockTestName#Subtest")
    assert resp.json() == expected_mock_org_mozilla

    # Only take test name into account.
    resp = client.get(url_base + "?path=org.mozilla.otherproduct.otherfolder.MockTestName")
    assert resp.json() == expected_mock_org_mozilla

    BugzillaComponent.objects.create(product="Testing", component="Mochitest")

    FilesBugzillaMap.objects.create(
        path="mock/mochitest/mochitest.test",
        file_name="mochitest.test",
        bugzilla_component=BugzillaComponent.objects.last(),
    )

    # Respect the ignore list of product and component combinations.
    resp = client.get(url_base + "?path=mock/mochitest/mochitest.test")
    assert resp.json() == []
