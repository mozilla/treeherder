import os
import pathlib

import pytest


def pytest_collection_modifyitems(config, items):
    for root, dirs, files in os.walk(pathlib.Path(__file__).parent):
        for dir in dirs:
            if dir in ["", "__pycache__"]:
                continue

            subfolder_path = pathlib.Path(__file__).parent / dir
            for item in items:
                if subfolder_path in pathlib.Path(item.fspath).parents:
                    item.add_marker(pytest.mark.perf)

        for file in files:
            for item in items:
                if str(item.fspath).endswith(file):
                    item.add_marker(pytest.mark.perf)
