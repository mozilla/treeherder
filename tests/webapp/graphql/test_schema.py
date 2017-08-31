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


def test_graphql_push_with_jobs(webapp, sample_push, eleven_jobs_stored, test_repository):
    """
    Retrieve a GraphQL set of a push and its jobs.
    """
    query = """
      query pushesQuery {{
        allPushes(revision: "{revision}") {{
            edges {{
              node {{
                revision
                repository {{
                  name
                }}
                jobs (tier_Lt: 3) {{
                  edges {{
                    node {{
                      guid
                      failureClassification {{
                        name
                      }}
                      jobLog {{
                        failureLine {{
                          test
                        }}
                      }}
                      jobType {{
                        symbol
                      }}
                      jobGroup {{
                        symbol
                      }}
                      optionCollectionHash
                      buildPlatform {{
                        platform
                      }}
                      textLogStep {{
                        errors {{
                          bugSuggestions
                        }}
                      }}
                    }}
                  }}
                }}
              }}
            }}
        }}
      }}
    """.format(revision=sample_push[0]["revision"])
    url = "{}?{}".format(reverse("graphql"), 'query={}'.format(query))
    resp = webapp.post(url)
    assert resp.status_int == 200
    response_dict = resp.json
    expected = {'data': {'allPushes': {'edges': [{'node': {'jobs': {
        'edges': [{'node': {'buildPlatform': {'platform': 'b2g-emu-jb'},
                            'failureClassification': {
                                'name': 'not classified'},
                            'guid': 'f1c75261017c7c5ce3000931dce4c442fe0a1297',
                            'jobGroup': {'symbol': '?'},
                            'jobLog': [{'failureLine': []}],
                            'jobType': {'symbol': 'B'},
                            'optionCollectionHash':
                                '32faaecac742100f7753f0c1d0aa0add01b4046b',
                            'textLogStep': []}},
                  {'node': {'buildPlatform': {'platform': 'b2g-emu-ics'},
                            'failureClassification': {
                                'name': 'not classified'},
                            'guid': '3f317a2869250b7f85876ac0cdc885923897ded2',
                            'jobGroup': {'symbol': '?'},
                            'jobLog': [{'failureLine': []}],
                            'jobType': {'symbol': 'B'},
                            'optionCollectionHash':
                                '32faaecac742100f7753f0c1d0aa0add01b4046b',
                            'textLogStep': []}}]},
        'repository': {'name': 'test_treeherder_jobs'},
        'revision': '45f8637cb9f78f19cb8463ff174e81756805d8cf'}}]}}}
    assert expected == response_dict
