from django.forms import ModelForm, Textarea, TextInput

from .models import Credentials


class CredentialsForm(ModelForm):

    class Meta:
        model = Credentials
        fields = ('client_id', 'description')
        widgets = {
            'client_id': TextInput(attrs={'class': 'form-control'}),
            'description': Textarea(attrs={'class': 'form-control'})
        }
