
How to make database changes
############################
Change seta/models.py, and then, once you're ready, jump inside vagrant and follow the instructions below.

Run this to generate the migration:

   python manage.py makemigrations seta

In the output you will see a file being generated with a number; take note of it for the following step.

To inspect the sql that this migration has generated run the following:

   python manage.py sqlmigrate seta number_of_migration

To run the tests run this:

   python manage.py test treeherder/seta
