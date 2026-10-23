from treeherder.perf.stats import interpret_cles


def test_interpret_cles():
    mock_base = [2.74]
    mock_new = [2.65]
    mock_mann_stat = 0.1
    interpretation = ("",)
    lower_is_better = (False,)
    mock_delta = 0.2

    (cles_obj, cles, cles_explanation, mann_whitney_u_cles, cliffs_delta_cles, is_base_greater) = (
        interpret_cles(
            mock_mann_stat,
            mock_new,
            mock_base,
            mock_delta,
            interpretation,
            lower_is_better,
        )
    )

    assert cles_obj["cles"] == 0.1
    assert cles == 0.1
    assert is_base_greater is False
