boolean_notanalyzed = {'type': 'boolean', 'index': 'not_analyzed'}
integer_notanalyzed = {'type': 'integer', 'index': 'not_analyzed'}
text_notanalyzed = {'type': 'text', 'index': 'not_analyzed'}

DOC_TYPE = 'failure-line'
INDEX_NAME = 'failure-lines'

INDEX_SETTINGS = {
    'failure-lines': {
        'mappings': {
            'failure-line': {
                'properties': {
                    'job_guid': text_notanalyzed,
                    'test': text_notanalyzed,
                    'subtest': text_notanalyzed,
                    'status': text_notanalyzed,
                    'expected': text_notanalyzed,
                    'best_classification': integer_notanalyzed,
                    'best_is_verified': boolean_notanalyzed,
                    'message': {
                        'type': 'text',
                        'analyzer': 'message_analyzer',
                        'search_analyzer': 'message_analyzer',
                    },
                },
            },
        },
        'settings': {
            'number_of_shards': 1,
            'analysis': {
                'analyzer': {
                    'message_analyzer': {
                        'type': 'custom',
                        'tokenizer': 'message_tokenizer',
                        'filters': [],
                    },
                },
                'tokenizer': {
                    'message_tokenizer': {
                        'type': 'pattern',
                        'pattern': r'0x[0-9a-fA-F]+|[\W0-9]+?',
                    },
                },
            },
        },
    },
}
