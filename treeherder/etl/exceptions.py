class CollectionNotStoredException(Exception):
    def __init__(self, error_list, *args, **kwargs):
        """
        error_list contains dictionaries, each containing
        project, url and message
        """
        super().__init__(args, kwargs)
        self.error_list = error_list

    def __str__(self):
        return "\n".join(
            [
                "[{project}] Error storing {collection} data: {message}".format(**error)
                for error in self.error_list
            ]
        )


class MissingPushException(Exception):
    pass
