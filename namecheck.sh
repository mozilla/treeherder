#!/usr/bin/env bash

# To obtain the user hostname
docker info --format '{{json .}}' | python3 -c "import sys, json; print(json.load(sys.stdin)['Name'])" > name.txt
