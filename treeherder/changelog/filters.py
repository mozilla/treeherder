import fnmatch


class Filters:
    def deployment(self, change, *options):
        message = change["message"]
        if "*PRODUCTION*" in message or "*STAGING*" in message:
            change["tags"] = ["deployment"]
            return change

    def only_releases(self, change, *options):
        if change["type"] == "release":
            return change

    def remove_auto_commits(self, change, *options):
        message = change["message"]
        start_text = ("Scheduled weekly dependency update", "Merge pull request")
        if not message.startswith(start_text):
            return change

    def filter_by_path(self, change, *options):
        if "files" not in change:
            return
        for file in change["files"]:
            for filter in options:
                if fnmatch.fnmatch(file, filter):
                    return change

    def __call__(self, message, filters):
        for filter in filters:
            if isinstance(filter, list):
                filter, options = filter[0], filter[1:]
            else:
                options = []
            message = getattr(self, filter)(message, *options)
            if message is None:
                return None
        return message
