from treeherder.perf.stats import interpret_cles


def test_interpret_cles():
    mock_base = [2.74]
    mock_new = [2.65]
    mock_mann_stat = 0.1

    cles_obj, is_base_greater = interpret_cles(
        mock_mann_stat,
        mock_new,
        mock_base,
    )

    assert cles_obj["cles"] == 0.1
    assert is_base_greater is False
