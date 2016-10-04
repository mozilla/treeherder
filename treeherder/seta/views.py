from django.http import HttpResponse
from django.shortcuts import render

def index(request):
    return render(request, 'seta/index.html', {})

def setadetails(request):
    return HttpResponse('Hello world!')
