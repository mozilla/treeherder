import os
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
path = lambda *a: os.path.join(PROJECT_DIR, *a)
