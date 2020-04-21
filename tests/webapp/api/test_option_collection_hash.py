from django.urls import reverse


def test_option_collection_list(client, sample_option_collections):
    resp = client.get(reverse("optioncollectionhash-list") + '?')
    assert resp.status_code == 200

    response = resp.json()

    print(response)

    assert len(response) == 2
    assert response == [
        {'option_collection_hash': 'option_hash1', 'options': [{'name': 'opt1'}]},
        {'option_collection_hash': 'option_hash2', 'options': [{'name': 'opt2'}]},
    ]
