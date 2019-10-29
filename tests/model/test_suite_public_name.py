import pytest
from django.db.utils import IntegrityError

SAME_SUITE_PUBLIC_NAME = 'same suite name'
SAME_TEST_PUBLIC_NAME = 'same test name'
SAME_SUITE = 'same suite'
SAME_TEST = 'same test'


@pytest.mark.parametrize("suite_public_name_1, suite_public_name_2,"
                         "test_public_name_1, test_public_name_2,"
                         "suite_1, suite_2, test_1, test_2", [
                             [SAME_SUITE_PUBLIC_NAME, SAME_SUITE_PUBLIC_NAME,
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              SAME_SUITE, SAME_SUITE, SAME_TEST, SAME_TEST],

                             [SAME_SUITE_PUBLIC_NAME, SAME_SUITE_PUBLIC_NAME,
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              SAME_SUITE, SAME_SUITE, 'test_1', 'test_2'],

                             [SAME_SUITE_PUBLIC_NAME, SAME_SUITE_PUBLIC_NAME,
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              'suite_1', 'suite_2', SAME_TEST, SAME_TEST],

                             [SAME_SUITE_PUBLIC_NAME, SAME_SUITE_PUBLIC_NAME,
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              'suite_1', 'suite_2', 'test_1', 'test_2'],
                         ])
def test_trigger_unique_constraint(test_perf_signature, test_perf_signature_2,
                                   suite_public_name_1, suite_public_name_2,
                                   test_public_name_1, test_public_name_2,
                                   suite_1, suite_2, test_1, test_2):
    test_perf_signature.suite_public_name = suite_public_name_1
    test_perf_signature.test_public_name = test_public_name_1
    test_perf_signature.suite = suite_1
    test_perf_signature.test = test_1

    test_perf_signature.save()

    test_perf_signature_2.suite_public_name = suite_public_name_2
    test_perf_signature_2.test_public_name = test_public_name_2
    test_perf_signature_2.suite = suite_2
    test_perf_signature_2.test = test_2

    with pytest.raises(IntegrityError):
        test_perf_signature_2.save()


@pytest.mark.parametrize("suite_public_name_1, suite_public_name_2,"
                         "test_public_name_1, test_public_name_2,"
                         "suite_1, suite_2, test_1, test_2", [
                             ['suite_public_name_1', 'suite_public_name_2',
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              'suite_1', 'suite_2', 'test_1', 'test_2'],

                             [SAME_SUITE_PUBLIC_NAME, SAME_SUITE_PUBLIC_NAME,
                              'test_public_name_1', 'test_public_name_2',
                              'suite_1', 'suite_2', 'test_1', 'test_2'],

                             ['suite_public_name_1', 'suite_public_name_2',
                              SAME_TEST_PUBLIC_NAME, SAME_TEST_PUBLIC_NAME,
                              SAME_SUITE, SAME_SUITE, SAME_TEST, SAME_TEST],

                             ['suite_public_name_1', 'suite_public_name_2',
                              'test_public_name_1', 'test_public_name_2',
                              'suite_1', 'suite_2', 'test_1', 'test_2'],
                         ])
def test_do_not_trigger_unique_constraint(test_perf_signature, test_perf_signature_2,
                                          suite_public_name_1, suite_public_name_2,
                                          test_public_name_1, test_public_name_2,
                                          suite_1, suite_2, test_1, test_2):
    test_perf_signature.suite_public_name = suite_public_name_1
    test_perf_signature.test_public_name = test_public_name_1
    test_perf_signature.suite = suite_1
    test_perf_signature.test = test_1

    test_perf_signature.save()

    test_perf_signature_2.suite_public_name = suite_public_name_2
    test_perf_signature_2.test_public_name = test_public_name_2
    test_perf_signature_2.suite = suite_2
    test_perf_signature_2.test = test_2

    test_perf_signature_2.save()
