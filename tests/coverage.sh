#!/bin/bash
pytest tests/ --runslow --ignore=tests=selenium/
pytest --cov=./ --cov-report=xml
codecov -t 995256be-3a1f-4d10-b181-e24f88603b6b && exit
