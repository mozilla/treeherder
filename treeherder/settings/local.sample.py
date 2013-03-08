from .base import *

DATABASES["default"].update({
    "NAME": "mydb",
    "USER": "myuser",
    "PASSWORD": "mypass",
})
