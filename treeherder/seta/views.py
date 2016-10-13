from django.http import HttpResponse


def index(request):
    return HttpResponse("Hello world! Welcome to SETA!")


def setadetails(request):
    return HttpResponse('Hello world!')
