# Max log size in bytes we will download (prior to decompression).
MAX_DOWNLOAD_SIZE_IN_BYTES = 5 * 1024 * 1024


class LogSizeException(Exception):
    pass
