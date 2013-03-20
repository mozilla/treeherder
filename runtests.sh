#!/bin/sh
py.test tests/$* --cov-report html --cov treeherder
