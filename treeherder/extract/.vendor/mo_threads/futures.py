from threading import Event


class Future(object):
    """
    REPRESENT A VALUE THAT MAY NOT BE READY YET
    """
    __slots__ = ["is_ready", "value"]

    def __init__(self):
        self.is_ready = Event()
        self.value = None

    def wait(self):
        """
        WAIT FOR VALUE
        :return: value that was assign()ed
        """
        self.is_ready.wait()
        return self.value

    def assign(self, value):
        """
        PROVIDE A VALUE THE OTHERS MAY BE WAITING ON
        """
        self.value = value
        self.is_ready.set()

