How do I generate the docs?
###########################

To generate the docs, follow these steps:
* Move inside docs/ directory
* pip install -r requirements.txt
* make html

To view the docs on a webserver http://127.0.0.1:8000 and auto-rebuild the documentation when any files are changed:
* make livehtml
