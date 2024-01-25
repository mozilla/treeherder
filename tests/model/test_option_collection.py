from treeherder.model.models import OptionCollection


def test_option_collection_map(sample_option_collections):
    option_map = OptionCollection.objects.get_option_collection_map()
    assert option_map == {"option_hash1": "opt1", "option_hash2": "opt2"}
