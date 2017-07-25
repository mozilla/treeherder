from django.core.urlresolvers import reverse


def test_graphql_options(webapp, eleven_jobs_stored, test_repository):
    """
    Retrieve a GraphQL set of the Options and OptionCollectionHashes.
    """
    url = "{}?{}".format(
        reverse("graphql"),
        'query=query{allOptionCollections{optionCollectionHash option{name}}}'
        )
    resp = webapp.post(url)
    assert resp.status_int == 200
    response_dict = resp.json
    expected = {'data': {
                    'allOptionCollections': [
                        {'option': {'name': 'opt'},
                         'optionCollectionHash': '102210fe594ee9b33d82058545b1ed14f4c8206e'
                         },
                        {'option': {'name': 'debug'},
                         'optionCollectionHash': '32faaecac742100f7753f0c1d0aa0add01b4046b'
                         }
                    ]
                }}
    assert expected == response_dict
