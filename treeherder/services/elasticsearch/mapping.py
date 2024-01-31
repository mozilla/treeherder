boolean = {"type": "boolean"}
integer = {"type": "integer"}
keyword = {"type": "keyword"}

DOC_TYPE = "failure-line"
INDEX_NAME = "failure-lines"

INDEX_SETTINGS = {
    "failure-lines": {
        "mappings": {
            "failure-line": {
                "properties": {
                    "job_guid": keyword,
                    "test": keyword,
                    "subtest": keyword,
                    "status": keyword,
                    "expected": keyword,
                    "best_classification": integer,
                    "best_is_verified": boolean,
                    "message": {
                        "type": "text",
                        "analyzer": "message_analyzer",
                        "search_analyzer": "message_analyzer",
                    },
                },
            },
        },
        "settings": {
            "number_of_shards": 1,
            "analysis": {
                "analyzer": {
                    "message_analyzer": {
                        "type": "custom",
                        "tokenizer": "message_tokenizer",
                        "filters": [],
                    },
                },
                "tokenizer": {
                    "message_tokenizer": {
                        "type": "pattern",
                        "pattern": r"0x[0-9a-fA-F]+|[\W0-9]+?",
                    },
                },
            },
        },
    },
}
