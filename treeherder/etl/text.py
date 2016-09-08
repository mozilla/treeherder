import re


def char_to_codepoint_ucs4(x):
    return ord(x)


def char_to_codepoint_ucs2(x):
    return (0x10000 + (ord(x[0]) - 0xD800) * 0x400 +
            (ord(x[1]) - 0xDC00))


# Regexp that matches all non-BMP unicode characters.
if len(u"\U0010FFFF") == 1:
    filter_re = re.compile(ur"([\U00010000-\U0010FFFF])", re.U)
    char_to_codepoint = char_to_codepoint_ucs4
else:
    # Python is compiled as the UCS2 variant so we have to match two
    # bytes in a surrogate pair. Then we have to decode the two bytes
    # according to UTF16 rules to get a single codepoint
    filter_re = re.compile(ur"([\uD800-\uDBFF][\uDC00-\uDFFF])", re.U)
    char_to_codepoint = char_to_codepoint_ucs2


def astral_filter(text):
    if text is None:
        return text
    return filter_re.sub(lambda x: "<U+%s>" % hex(char_to_codepoint(x.group(0)))[2:].zfill(6).upper(), text)
