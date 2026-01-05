from django_filters.rest_framework import DjangoFilterBackend


class TreeherderFilterBackend(DjangoFilterBackend):
    """
    Custom backend to support get_schema_operation_parameters
    """

    def get_schema_operation_parameters(self, view):
        try:
            return super().get_schema_operation_parameters(view)
        except AttributeError:
            # Fallback for when the method is missing
            queryset = None
            try:
                queryset = view.get_queryset()
            except Exception:
                pass

            filterset_class = self.get_filterset_class(view, queryset)
            if not filterset_class:
                return []

            parameters = []
            for name, field in filterset_class.base_filters.items():
                parameter = {
                    "name": name,
                    "required": field.extra.get("required", False),
                    "in": "query",
                    "description": str(field.label) if field.label else name,
                    "schema": {
                        "type": "string",
                    },
                }
                parameters.append(parameter)
            return parameters
