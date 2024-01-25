from rest_framework.exceptions import APIException


class InsufficientAlertCreationData(APIException):
    status_code = 400
    default_detail = "Insufficient data to create an alert"
