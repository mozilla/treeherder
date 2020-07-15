# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

import math
import re
from datetime import date, datetime, timedelta
from decimal import Decimal

from hjson import loads as hjson2value
from mo_logs.exceptions import get_stacktrace

from mo_dots import Data, FlatList, Null, NullType, SLOT, is_data, to_data, leaves_to_data
from mo_dots.objects import DataObject
from mo_future import PY2, integer_types, is_binary, is_text, items, long, none_type, text, PY3
from mo_logs import Except, Log, strings
from mo_logs.strings import expand_template
from mo_times import Date, Duration

FIND_LOOPS = False
SNAP_TO_BASE_10 = False  # Identify floats near a round base10 value (has 000 or 999) and shorten
CAN_NOT_DECODE_JSON = "Can not decode JSON"

IS_NULL = '0'
BOOLEAN = 'boolean'
INTEGER = 'integer'
NUMBER = 'number'
TIME = 'time'
INTERVAL = 'interval'
STRING = 'string'
OBJECT = 'object'
NESTED = "nested"
EXISTS = "exists"

ALL_TYPES = {IS_NULL: IS_NULL, BOOLEAN: BOOLEAN, INTEGER: INTEGER, NUMBER: NUMBER, TIME:TIME, INTERVAL:INTERVAL, STRING: STRING, OBJECT: OBJECT, NESTED: NESTED, EXISTS: EXISTS}
JSON_TYPES = (BOOLEAN, INTEGER, NUMBER, STRING, OBJECT)
NUMBER_TYPES = (INTEGER, TIME, INTERVAL, NUMBER)
PRIMITIVE = (EXISTS, BOOLEAN, INTEGER, NUMBER, TIME, INTERVAL, STRING)
INTERNAL = (EXISTS, OBJECT, NESTED)
STRUCT = (OBJECT, NESTED)


true, false, null = True, False, None

_get = object.__getattribute__


ESCAPE_DCT = {
    u"\\": u"\\\\",
    u"\"": u"\\\"",
    u"\b": u"\\b",
    u"\f": u"\\f",
    u"\n": u"\\n",
    u"\r": u"\\r",
    u"\t": u"\\t",
}
for i in range(0x20):
    ESCAPE_DCT.setdefault(chr(i), u'\\u{0:04x}'.format(i))

ESCAPE = re.compile(r'[\x00-\x1f\\"\b\f\n\r\t]')


def replace(match):
    return ESCAPE_DCT[match.group(0)]


def float2json(value):
    """
    CONVERT NUMBER TO JSON STRING, WITH BETTER CONTROL OVER ACCURACY
    :param value: float, int, long, Decimal
    :return: unicode
    """
    if value == 0:
        return u'0'
    try:
        sign = "-" if value < 0 else ""
        value = abs(value)
        sci = value.__format__(".15e")
        mantissa, str_exp = sci.split("e")
        digits, more_digits = _snap_to_base_10(mantissa)
        int_exp = int(str_exp) + more_digits
        if int_exp > 15:
            return sign + digits[0] + '.' + (digits[1:].rstrip('0') or '0') + u"e" + text(int_exp)
        elif int_exp >= 0:
            return sign + (digits[:1 + int_exp] + '.' + digits[1 + int_exp:].rstrip('0')).rstrip('.')
        elif -4 < int_exp:
            digits = ("0" * (-int_exp)) + digits
            return sign + (digits[:1] + '.' + digits[1:].rstrip('0')).rstrip('.')
        else:
            return sign + digits[0] + '.' + (digits[1:].rstrip('0') or '0') + u"e" + text(int_exp)
    except Exception as e:
        from mo_logs import Log
        Log.error("not expected", e)


def _snap_to_base_10(mantissa):
    # TODO: https://lists.nongnu.org/archive/html/gcl-devel/2012-10/pdfkieTlklRzN.pdf
    digits = mantissa.replace('.', '')
    if SNAP_TO_BASE_10:
        f9 = strings.find(digits, '999')
        f0 = strings.find(digits, '000')
        if f9 == 0:
            return '1000000000000000', 1
        elif f9 < f0:
            digits = text(int(digits[:f9]) + 1) + ('0' * (16 - f9))
        else:
            digits = digits[:f0]+('0'*(16-f0))
    return digits, 0


def _scrub_number(value):
    d = float(value)
    i_d = int(d)
    if float(i_d) == d:
        return i_d
    else:
        return d


def _keep_whitespace(value):
    if value.strip():
        return value
    else:
        return None


def trim_whitespace(value):
    value_ = value.strip()
    if value_:
        return value_
    else:
        return None


def is_number(s):
    try:
        s = float(s)
        return not math.isnan(s)
    except Exception:
        return False


def scrub(value, scrub_text=_keep_whitespace, scrub_number=_scrub_number):
    """
    REMOVE/REPLACE VALUES THAT CAN NOT BE JSON-IZED
    """
    return _scrub(value, set(), [], scrub_text=scrub_text, scrub_number=scrub_number)


def _scrub(value, is_done, stack, scrub_text, scrub_number):
    if FIND_LOOPS:
        _id = id(value)
        if _id in stack and type(_id).__name__ not in ["int"]:
            Log.error("loop in JSON")
        stack = stack + [_id]
    type_ = value.__class__

    if type_ in (none_type, NullType):
        return None
    elif type_ is text:
        return scrub_text(value)
    elif type_ is float:
        if math.isnan(value) or math.isinf(value):
            return None
        return scrub_number(value)
    elif type_ is bool:
        return value
    elif type_ in integer_types:
        return scrub_number(value)
    elif type_ in (date, datetime):
        return scrub_number(datetime2unix(value))
    elif type_ is timedelta:
        return value.total_seconds()
    elif type_ is Date:
        return scrub_number(value.unix)
    elif type_ is Duration:
        return scrub_number(value.seconds)
    elif type_ is str:
        return value.decode('utf8')
    elif type_ is Decimal:
        return scrub_number(value)
    elif type_ is Data:
        return _scrub(_get(value, SLOT), is_done, stack, scrub_text, scrub_number)
    elif is_data(value):
        _id = id(value)
        if _id in is_done:
            Log.warning("possible loop in structure detected")
            return '"<LOOP IN STRUCTURE>"'
        is_done.add(_id)

        output = {}
        for k, v in value.items():
            if is_text(k):
                pass
            elif is_binary(k):
                k = k.decode('utf8')
            else:
                Log.error("keys must be strings")
            v = _scrub(v, is_done, stack, scrub_text, scrub_number)
            if v != None or is_data(v):
                output[k] = v

        is_done.discard(_id)
        return output
    elif type_ in (tuple, list, FlatList):
        output = []
        for v in value:
            v = _scrub(v, is_done, stack, scrub_text, scrub_number)
            output.append(v)
        return output  # if output else None
    elif type_ is type:
        return value.__name__
    elif type_.__name__ == "bool_":  # DEAR ME!  Numpy has it's own booleans (value==False could be used, but 0==False in Python.  DOH!)
        if value == False:
            return False
        else:
            return True
    elif not isinstance(value, Except) and isinstance(value, Exception):
        return _scrub(Except.wrap(value), is_done, stack, scrub_text, scrub_number)
    elif hasattr(value, '__data__'):
        try:
            return _scrub(value.__data__(), is_done, stack, scrub_text, scrub_number)
        except Exception as e:
            Log.error("problem with calling __json__()", e)
    elif hasattr(value, 'co_code') or hasattr(value, "f_locals"):
        return None
    elif hasattr(value, '__iter__'):
        output = []
        for v in value:
            v = _scrub(v, is_done, stack, scrub_text, scrub_number)
            output.append(v)
        return output
    elif hasattr(value, '__call__'):
        return text(repr(value))
    elif is_number(value):
        # for numpy values
        return scrub_number(value)
    else:
        return _scrub(DataObject(value), is_done, stack, scrub_text, scrub_number)


def value2json(obj, pretty=False, sort_keys=False, keep_whitespace=True):
    """
    :param obj:  THE VALUE TO TURN INTO JSON
    :param pretty: True TO MAKE A MULTI-LINE PRETTY VERSION
    :param sort_keys: True TO SORT KEYS
    :param keep_whitespace: False TO strip() THE WHITESPACE IN THE VALUES
    :return:
    """
    if FIND_LOOPS:
        obj = scrub(obj, scrub_text=_keep_whitespace if keep_whitespace else trim_whitespace)
    try:
        json = json_encoder(obj, pretty=pretty)
        if json == None:
            Log.note(str(type(obj)) + " is not valid{{type}}JSON", type=" (pretty) " if pretty else " ")
            Log.error("Not valid JSON: " + str(obj) + " of type " + str(type(obj)))
        return json
    except Exception as e:
        e = Except.wrap(e)
        try:
            json = pypy_json_encode(obj)
            return json
        except Exception:
            pass
        Log.error("Can not encode into JSON: {{value}}", value=text(repr(obj)), cause=e)


def remove_line_comment(line):
    mode = 0  # 0=code, 1=inside_string, 2=escaping
    for i, c in enumerate(line):
        if c == '"':
            if mode == 0:
                mode = 1
            elif mode == 1:
                mode = 0
            else:
                mode = 1
        elif c == '\\':
            if mode == 0:
                mode = 0
            elif mode == 1:
                mode = 2
            else:
                mode = 1
        elif mode == 2:
            mode = 1
        elif c == "#" and mode == 0:
            return line[0:i]
        elif c == "/" and mode == 0 and line[i + 1] == "/":
            return line[0:i]
    return line


def check_depth(json, limit=30):
    """
    THROW ERROR IF JSON IS TOO DEEP
    :param json:  THE JSON STRING TO CHECK
    :param limit:  EXIST EARLY IF TOO DEEP
    """
    l = len(json)
    expecting = ["{"] * limit
    e = -1
    i = 0
    while i < l:
        c = json[i]
        if c == '"':
            i += 1
            while True:
                c = json[i]
                if c == "\\" and json[i + 1] == '"':
                    i += 2
                    continue
                i += 1
                if c == '"':
                    break
        elif c == "{":
            e += 1
            expecting[e] = "}"
            i += 1
        elif c == "[":
            e += 1
            expecting[e] = "]"
            i += 1
        elif c in "]}":
            if expecting[e] == c:
                e -= 1
            else:
                Log.error("invalid JSON")
            i += 1
        else:
            i += 1


def json2value(json_string, params=Null, flexible=False, leaves=False):
    """
    :param json_string: THE JSON
    :param params: STANDARD JSON PARAMS
    :param flexible: REMOVE COMMENTS
    :param leaves: ASSUME JSON KEYS ARE DOT-DELIMITED
    :return: Python value
    """
    json_string = text(json_string)
    if not is_text(json_string) and json_string.__class__.__name__ != "FileString":
        Log.error("only unicode json accepted")

    try:
        if params:
            # LOOKUP REFERENCES
            json_string = expand_template(json_string, params)

        if flexible:
            value = hjson2value(json_string)
        else:
            value = to_data(json_decoder(text(json_string)))

        if leaves:
            value = leaves_to_data(value)

        return value

    except Exception as e:
        e = Except.wrap(e)

        if not json_string.strip():
            Log.error("JSON string is only whitespace")

        c = e
        while "Expecting '" in c.cause and "' delimiter: line" in c.cause:
            c = c.cause

        if "Expecting '" in c and "' delimiter: line" in c:
            line_index = int(strings.between(c.message, " line ", " column ")) - 1
            column = int(strings.between(c.message, " column ", " ")) - 1
            line = json_string.split("\n")[line_index].replace("\t", " ")
            if column > 20:
                sample = "..." + line[column - 20:]
                pointer = "   " + (" " * 20) + "^"
            else:
                sample = line
                pointer = (" " * column) + "^"

            if len(sample) > 43:
                sample = sample[:43] + "..."

            Log.error(CAN_NOT_DECODE_JSON + " at:\n\t{{sample}}\n\t{{pointer}}\n", sample=sample, pointer=pointer)

        base_str = strings.limit(json_string, 1000).encode('utf8')
        hexx_str = bytes2hex(base_str, " ")
        try:
            char_str = " " + "  ".join((c.decode("latin1") if ord(c) >= 32 else ".") for c in base_str)
        except Exception:
            char_str = " "
        Log.error(CAN_NOT_DECODE_JSON + ":\n{{char_str}}\n{{hexx_str}}\n", char_str=char_str, hexx_str=hexx_str, cause=e)

if PY3:
    def bytes2hex(value, separator=" "):
        return separator.join('{:02X}'.format(x) for x in value)
else:
    def bytes2hex(value, separator=" "):
        return separator.join('{:02X}'.format(ord(x)) for x in value)


if PY3:
    from datetime import timezone
    DATETIME_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
else:
    DATETIME_EPOCH = datetime(1970, 1, 1)
DATE_EPOCH = date(1970, 1, 1)


def datetime2unix(value):
    try:
        if value == None:
            return None
        elif isinstance(value, datetime):
            if value.tzinfo:
                diff = value - DATETIME_EPOCH
            else:
                diff = value - DATETIME_EPOCH.replace(tzinfo=None)
            return diff.total_seconds()
        elif isinstance(value, date):
            diff = value - DATE_EPOCH
            return diff.total_seconds()
        else:
            from mo_logs import Log
            Log.error("Can not convert {{value}} of type {{type}}", value=value, type=value.__class__)
    except Exception as e:
        from mo_logs import Log
        Log.error("Can not convert {{value}}", value=value, cause=e)

python_type_to_json_type = {
    int: INTEGER,
    text: STRING,
    float: NUMBER,
    Decimal: NUMBER,
    bool: BOOLEAN,
    NullType: OBJECT,
    none_type: OBJECT,
    Data: OBJECT,
    dict: OBJECT,
    object: OBJECT,
    list: NESTED,
    set: NESTED,
    # tuple: NESTED,  # DO NOT INCLUDE, WILL HIDE LOGIC ERRORS
    FlatList: NESTED,
    Date: TIME,
    datetime: TIME,
    date: TIME,
}

if PY2:
    python_type_to_json_type[str] = STRING
    python_type_to_json_type[long] = INTEGER


for k, v in items(python_type_to_json_type):
    python_type_to_json_type[k.__name__] = v

_merge_order = {
    IS_NULL: 0,
    BOOLEAN: 1,
    INTEGER: 2,
    TIME: 3,
    INTERVAL: 3,
    NUMBER: 3,
    STRING: 6,
    OBJECT: 7,
    NESTED: 8
}


def same_json_type(A, B):
    return A == B or (A in NUMBER_TYPES and B in NUMBER_TYPES)


def merge_json_type(*types):
    output = IS_NULL
    m = 0
    for t in types:
        o = _merge_order[t]
        if o > m:
            m = o
            if m == 3:
                # SNAP TO NUMBER
                output = NUMBER
            else:
                output = t
    return output


from mo_json.decoder import json_decoder
from mo_json.encoder import json_encoder, pypy_json_encode
