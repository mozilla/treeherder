import re

# Regexp that matches all non-BMP unicode characters.
filter_re = re.compile(r"([\U00010000-\U0010FFFF])", re.U)


def convert_unicode_character_to_ascii_repr(match_obj):
    """
    Converts a matched pattern from a unicode character to an ASCII representation

    For example the emoji 🍆 would get converted to the literal <U+01F346>
    """
    match = match_obj.group(0)
    code_point = ord(match)

    hex_repr = hex(code_point)
    hex_code_point = hex_repr[2:]

    hex_value = hex_code_point.zfill(6).upper()

    return f"<U+{hex_value}>"


def astral_filter(text):
    if text is None:
        return text

    return filter_re.sub(convert_unicode_character_to_ascii_repr, text)
