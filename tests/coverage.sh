#!/usr/bin/env bash

exec pytest --cov=./ --cov-report=xml
