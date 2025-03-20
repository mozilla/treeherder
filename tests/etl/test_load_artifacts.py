import json

import pytest
from django.core.cache import caches

from treeherder.etl.artifact import store_job_artifacts
from treeherder.model.error_summary import MemDBCache, get_error_summary
from treeherder.model.models import TextLogError


def test_load_textlog_summary_twice(test_repository, test_job):
    text_log_summary_artifact = {
        "type": "json",
        "name": "text_log_summary",
        "blob": json.dumps(
            {
                "errors": [
                    {"line": "WARNING - foobar", "linenumber": 1587},
                    {"line": "WARNING - foobar", "linenumber": 1590},
                ],
            }
        ),
        "job_guid": test_job.guid,
    }

    store_job_artifacts([text_log_summary_artifact])
    assert TextLogError.objects.count() == 2
    # load again (simulating the job being parsed twice,
    # which sometimes happens)
    store_job_artifacts([text_log_summary_artifact])
    assert TextLogError.objects.count() == 2


def test_load_non_ascii_textlog_errors(test_job):
    text_log_summary_artifact = {
        "type": "json",
        "name": "text_log_summary",
        "blob": json.dumps(
            {
                "errors": [
                    {
                        # non-ascii character
                        "line": "07:51:28  WARNING - \U000000c3",
                        "linenumber": 1587,
                    },
                    {
                        # astral character (i.e. higher than ucs2)
                        "line": "07:51:29  WARNING - \U0001d400",
                        "linenumber": 1588,
                    },
                ],
            }
        ),
        "job_guid": test_job.guid,
    }

    # ensure a result='failed' to treat failure as a NEW_failure
    test_job.result = "testfailed"
    test_job.save()

    store_job_artifacts([text_log_summary_artifact])

    # ensure bug_suggestions data is stored and retrieved properly
    tle_all = TextLogError.objects.all()
    bug_suggestions = get_error_summary(test_job)
    for suggestion in bug_suggestions:
        tle = next(t for t in tle_all if t.line_number == suggestion["line_number"])
        assert suggestion["failure_new_in_rev"] == tle.new_failure

    assert TextLogError.objects.count() == 2
    assert TextLogError.objects.get(line_number=1587).line == "07:51:28  WARNING - \U000000c3"
    assert TextLogError.objects.get(line_number=1588).line == "07:51:29  WARNING - <U+01D400>"


@pytest.mark.django_db
def test_memcache_migration():
    root = "th_test"

    date = "2025-01-01"
    date2 = "2025-02-01"
    # add stuff to line_cache, write to memcache, verify not in db_cache
    line_cache = {}
    line_cache[date] = {
        "new_lines": {"this is a trap": 31415926535},
        "this is a trap": 1,
    }

    db_cache = caches["db_cache"]
    db_cache.set(root, line_cache)

    # ensure we can get the cache and it is a dict with key "date"
    lcache = db_cache.get(root)
    assert date in lcache

    lcache = MemDBCache(root)

    # this will migrate the old format to the new
    lc = lcache.get_cache()
    assert date in lc
    assert lcache.get_cache_keys() == [f"{date}"]

    # add an extra date
    lc[date2] = lc[date]
    lcache.write_cache(date2)
    assert date2 in lc
    assert lcache.get_cache_keys() == [date, date2]

    # flush cache so we can reload
    memcache = caches["default"]
    memcache.delete(root)
    assert memcache.get(root) == None

    # reload cache
    lc = lcache.get_cache()
    assert date in lc
    assert date2 in lc
    assert lcache.get_cache_keys() == [date, date2]


@pytest.mark.django_db
def test_memcache_to_db_class():
    root = "th_test"
    lcache = MemDBCache(root)
    line_cache = lcache.get_cache()

    date = "2025-01-01"
    # add stuff to line_cache, write to memcache, verify not in db_cache
    line_cache[date] = {
        "new_lines": {"this is a trap": 31415926535},
        "this is a trap": 1,
    }
    assert caches["default"].get(f"{root}_{date}") is None

    # write to memcache
    lcache.update_cache(date, line_cache[date])
    assert len(lcache.get_cache_keys()) == 0

    # add key to db
    lcache.add_cache_keys(date)
    assert len(lcache.get_cache_keys()) == 1

    db_data = caches["db_cache"].get(f"{root}_{date}")
    assert db_data is None

    # bulk write entire memcache -> db
    lcache.write_cache()
    db_data = caches["db_cache"].get(f"{root}_{date}")
    assert db_data == line_cache[date]

    date2 = "2025-01-02"
    line_cache[date2] = {
        "new_lines": {"this is a trap2": 31415926535},
        "this is a trap2": 1,
    }

    # write only date2 to db
    lcache.write_cache(date2, line_cache[date2])
    assert len(lcache.get_cache_keys()) == 2
    db_data = caches["db_cache"].get(f"{root}_{date2}")
    assert db_data == line_cache[date2]

    # expire cache
    lcache.remove_cache_key(date)
    assert len(lcache.get_cache_keys()) == 1

    # ensure we only have date2
    line_cache = lcache.get_cache()
    assert len(line_cache.keys()) == 1

    # remove it all
    lcache.remove_cache_key(date2)
    line_cache = lcache.get_cache()
    assert len(line_cache.keys()) == 0
