import re

if len(u"\U0010FFFF") != 1:
    raise Exception('Python has been compiled in UCS-2 mode which is not supported.')

# Regexp that matches all non-BMP unicode characters.
filter_re = re.compile(ur"([\U00010000-\U0010FFFF])", re.U)


def astral_filter(text):
    if text is None:
        return text
    return filter_re.sub(lambda x: "<U+%s>" % hex(ord(x.group(0)))[2:].zfill(6).upper(), text)
