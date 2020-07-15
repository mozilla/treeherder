# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

from __future__ import absolute_import, division, unicode_literals

import sys

from mo_future import binary_type, generator_types, is_binary, is_text, text, OrderedDict, none_type

from mo_dots.utils import CLASS, OBJ, get_logger, get_module

_module_type = type(sys.modules[__name__])
_builtin_zip = zip
_get = object.__getattribute__
_set = object.__setattr__
_new = object.__new__


ROOT_PATH = ["."]


def inverse(d):
    """
    reverse the k:v pairs
    """
    output = {}
    for k, v in from_data(d).items():
        output[v] = output.get(v, [])
        output[v].append(k)
    return output


def coalesce(*args):
    # pick the first not null value
    # http://en.wikipedia.org/wiki/Null_coalescing_operator
    for a in args:
        if a != None:
            return to_data(a)
    return Null


def zip(keys, values):
    """
    CONVERT LIST OF KEY/VALUE PAIRS TO Data
    PLEASE `import dot`, AND CALL `dot.zip()`
    """
    output = Data()
    for i, k in enumerate(keys):
        if i >= len(values):
            break
        output[k] = values[i]
    return output


def missing(value):
    return value == None or value == ''


def exists(value):
    return value != None and value != ''


def literal_field(field):
    """
    RETURN SAME WITH DOTS (`.`) ESCAPED
    """
    try:
        return field.replace(".", "\\.")
    except Exception as e:
        get_logger().error("bad literal", e)


def unliteral_field(field):
    """
    DUE TO PATHOLOGY IN MY CODE WE HAVE A path WITH ESCAPED DOTS BUT WE WANT OT USE IT ON A dict, NOT A Data
    a = dict()
    b = Data(a)
    a[unliteral_field(k)]==b[k] (for all k)

    :param field: THE STRING TO DE-literal IZE
    :return: SIMPLER STRING
    """
    if len(split_field(field)) > 1:
        get_logger().error("Bad call! Dude!")
    return field.replace("\\.", ".")


def tail_field(field):
    """
    RETURN THE FIRST STEP IN PATH, ALONG WITH THE REMAINING TAIL
    IN (first, rest) PAIR
    """
    if field == "." or field==None:
        return ".", "."
    elif "." in field:
        if "\\." in field:
            path = field.replace("\\.", "\a").split(".", 1)
            if len(path) == 1:
                return path[0].replace("\a", "."), "."
            else:
                return tuple(k.replace("\a", ".") for k in path)
        else:
            return field.split(".", 1)
    else:
        return field, "."



def split_field(field):
    """
    RETURN field AS ARRAY OF DOT-SEPARATED FIELDS
    """
    if field == "." or field==None:
        return []
    elif is_text(field) and "." in field:
        if field.startswith(".."):
            remainder = field.lstrip(".")
            back = len(field) - len(remainder) - 1
            return [-1]*back + [k.replace("\a", ".") for k in remainder.replace("\\.", "\a").split(".")]
        else:
            return [k.replace("\a", ".") for k in field.replace("\\.", "\a").split(".")]
    else:
        return [field]


def join_field(path):
    """
    RETURN field SEQUENCE AS STRING
    """
    output = ".".join([f.replace(".", "\\.") for f in path if f != None])
    return output if output else "."

    # potent = [f for f in path if f != "."]
    # if not potent:
    #     return "."
    # return ".".join([f.replace(".", "\\.") for f in potent])


def concat_field(prefix, suffix):
    if suffix.startswith(".."):
        remainder = suffix.lstrip(".")
        back = len(suffix) - len(remainder) - 1
        prefix_path=split_field(prefix)
        if len(prefix_path)>=back:
            return join_field(split_field(prefix)[:-back]+split_field(remainder))
        else:
            return "." * (back - len(prefix_path)) + "." + remainder
    else:
        return join_field(split_field(prefix) + split_field(suffix))


def startswith_field(field, prefix):
    """
    RETURN True IF field PATH STRING STARTS WITH prefix PATH STRING
    """
    if prefix == None:
        return False
    if prefix.startswith("."):
        return True
        # f_back = len(field) - len(field.strip("."))
        # p_back = len(prefix) - len(prefix.strip("."))
        # if f_back > p_back:
        #     return False
        # else:
        #     return True

    if field.startswith(prefix):
        if len(field) == len(prefix) or field[len(prefix)] == ".":
            return True
    return False


def relative_field(field, parent):
    """
    RETURN field PATH WITH RESPECT TO parent
    """
    if parent==".":
        return field

    field_path = split_field(field)
    parent_path = split_field(parent)
    common = 0
    for f, p in _builtin_zip(field_path, parent_path):
        if f != p:
            break
        common += 1

    if len(parent_path) == common:
        return join_field(field_path[common:])
    else:
        dots = "." * (len(parent_path) - common)
        return dots + "." + join_field(field_path[common:])


def hash_value(v):
    if is_many(v):
        return hash(tuple(hash_value(vv) for vv in v))
    elif _get(v, CLASS) not in data_types:
        return hash(v)
    else:
        return hash(tuple(sorted(hash_value(vv) for vv in v.values())))


def set_default(*dicts):
    """
    RECURSIVE MERGE OF MULTIPLE dicts MOST IMPORTANT FIRST

    UPDATES dicts[0] WITH THE MERGE RESULT, WHERE MERGE RESULT IS DEFINED AS:
    FOR EACH LEAF, RETURN THE FIRST NOT-NULL LEAF VALUE

    :param dicts: dicts IN PRIORITY ORDER, HIHEST TO LOWEST
    :return: dicts[0]
    """
    p0 = dicts[0]
    agg = p0 if p0 or _get(p0, CLASS) in data_types else {}
    for p in dicts[1:]:
        p = from_data(p)
        if p is None:
            continue
        _all_default(agg, p, seen={})
    return to_data(agg)


def _all_default(d, default, seen=None):
    """
    ANY VALUE NOT SET WILL BE SET BY THE default
    THIS IS RECURSIVE
    """
    if default is None:
        return
    if _get(default, CLASS) is Data:
        default = object.__getattribute__(default, SLOT)  # REACH IN AND GET THE dict
        # Log = _late_import()
        # Log.error("strictly dict (or object) allowed: got {{type}}", type=_get(default, CLASS).__name__)

    for k, default_value in default.items():
        default_value = from_data(default_value)  # TWO DIFFERENT Dicts CAN SHARE id() BECAUSE THEY ARE SHORT LIVED
        if is_data(d):
            existing_value = d.get(k)
        else:
            existing_value = _get_attr(d, [k])

        if existing_value == None:
            if default_value != None:
                if _get(default_value, CLASS) in data_types:
                    df = seen.get(id(default_value))
                    if df is not None:
                        _set_attr(d, [k], df)
                    else:
                        copy_dict = {}
                        seen[id(default_value)] = copy_dict
                        _set_attr(d, [k], copy_dict)
                        _all_default(copy_dict, default_value, seen)
                else:
                    # ASSUME PRIMITIVE (OR LIST, WHICH WE DO NOT COPY)
                    try:
                        _set_attr(d, [k], default_value)
                    except Exception as e:
                        if PATH_NOT_FOUND not in e:
                            get_logger().error("Can not set attribute {{name}}", name=k, cause=e)
        elif is_list(existing_value) or is_list(default_value):
            _set_attr(d, [k], None)
            _set_attr(d, [k], listwrap(existing_value) + listwrap(default_value))
        elif (hasattr(existing_value, "__setattr__") or _get(existing_value, CLASS) in data_types) and _get(default_value, CLASS) in data_types:
            df = seen.get(id(default_value))
            if df is not None:
                _set_attr(d, [k], df)
            else:
                seen[id(default_value)] = existing_value
                _all_default(existing_value, default_value, seen)


def _get_dict_default(obj, key):
    """
    obj MUST BE A DICT
    key IS EXPECTED TO BE LITERAL (NO ESCAPING)
    TRY BOTH ATTRIBUTE AND ITEM ACCESS, OR RETURN Null
    """
    try:
        return obj[key]
    except Exception as f:
        pass

    try:
        if float(key) == round(float(key), 0):
            return obj[int(key)]
    except Exception as f:
        pass

    return NullType(obj, key)


def _getdefault(obj, key):
    """
    obj ANY OBJECT
    key IS EXPECTED TO BE LITERAL (NO ESCAPING)
    TRY BOTH ATTRIBUTE AND ITEM ACCESS, OR RETURN Null
    """
    try:
        return obj[key]
    except Exception as f:
        pass

    try:
        if obj.__class__ is not dict:
            return getattr(obj, key)
    except Exception as f:
        pass


    try:
        if float(key) == round(float(key), 0):
            return obj[int(key)]
    except Exception as f:
        pass


    # TODO: FIGURE OUT WHY THIS WAS EVER HERE (AND MAKE A TEST)
    # try:
    #     return eval("obj."+text(key))
    # except Exception as f:
    #     pass
    return NullType(obj, key)


PATH_NOT_FOUND = "Path not found"
AMBIGUOUS_PATH_FOUND = "Path is ambiguous"


def set_attr(obj, path, value):
    """
    SAME AS object.__setattr__(), BUT USES DOT-DELIMITED path
    RETURN OLD VALUE
    """
    try:
        return _set_attr(obj, split_field(path), value)
    except Exception as e:
        Log = get_logger()
        if PATH_NOT_FOUND in e:
            Log.warning(PATH_NOT_FOUND + ": {{path}}", path=path, cause=e)
        else:
            Log.error("Problem setting value", cause=e)


def get_attr(obj, path):
    """
    SAME AS object.__getattr__(), BUT USES DOT-DELIMITED path
    """
    try:
        return _get_attr(obj, split_field(path))
    except Exception as e:
        Log = get_logger()
        if PATH_NOT_FOUND in e:
            Log.error(PATH_NOT_FOUND+": {{path}}",  path=path, cause=e)
        else:
            Log.error("Problem setting value", e)


def _get_attr(obj, path):
    if not path:
        return obj

    attr_name = path[0]

    if isinstance(obj, _module_type):
        if attr_name in obj.__dict__:
            return _get_attr(obj.__dict__[attr_name], path[1:])
        elif attr_name in dir(obj):
            return _get_attr(obj[attr_name], path[1:])

        # TRY FILESYSTEM
        File = get_module("mo_files").File
        possible_error = None
        python_file = (File(obj.__file__).parent / attr_name).set_extension("py")
        python_module = (File(obj.__file__).parent / attr_name / "__init__.py")
        if python_file.exists or python_module.exists:
            try:
                # THIS CASE IS WHEN THE __init__.py DOES NOT IMPORT THE SUBDIR FILE
                # WE CAN STILL PUT THE PATH TO THE FILE IN THE from CLAUSE
                if len(path) == 1:
                    # GET MODULE OBJECT
                    output = __import__(obj.__name__ + str(".") + str(attr_name), globals(), locals(), [str(attr_name)], 0)
                    return output
                else:
                    # GET VARIABLE IN MODULE
                    output = __import__(obj.__name__ + str(".") + str(attr_name), globals(), locals(), [str(path[1])], 0)
                    return _get_attr(output, path[1:])
            except Exception as e:
                Except = get_module("mo_logs.exceptions.Except")
                possible_error = Except.wrap(e)

        # TRY A CASE-INSENSITIVE MATCH
        matched_attr_name = lower_match(attr_name, dir(obj))
        if not matched_attr_name:
            get_logger().warning(PATH_NOT_FOUND + "({{name|quote}}) Returning None.", name=attr_name, cause=possible_error)
        elif len(matched_attr_name) > 1:
            get_logger().error(AMBIGUOUS_PATH_FOUND + " {{paths}}", paths=attr_name)
        else:
            return _get_attr(obj[matched_attr_name[0]], path[1:])

    try:
        obj = obj[int(attr_name)]
        return _get_attr(obj, path[1:])
    except Exception:
        pass

    try:
        obj = getattr(obj, attr_name)
        return _get_attr(obj, path[1:])
    except Exception:
        pass

    try:
        obj = obj[attr_name]
        return _get_attr(obj, path[1:])
    except Exception as f:
        return None


def _set_attr(obj_, path, value):
    obj = _get_attr(obj_, path[:-1])
    if obj is None:  # DELIBERATE USE OF `is`: WE DO NOT WHAT TO CATCH Null HERE (THEY CAN BE SET)
        obj = _get_attr(obj_, path[:-1])
        if obj is None:
            get_logger().error(PATH_NOT_FOUND+" tried to get attribute of None")

    attr_name = path[-1]

    # ACTUAL SETTING OF VALUE
    try:
        old_value = _get_attr(obj, [attr_name])
        old_type = _get(old_value, CLASS)
        if old_value == None or old_type in (bool, int, float, text, binary_type):
            old_value = None
            new_value = value
        elif value == None:
            new_value = None
        else:
            new_value = _get(old_value, CLASS)(value)  # TRY TO MAKE INSTANCE OF SAME CLASS
    except Exception:
        old_value = None
        new_value = value

    try:
        setattr(obj, attr_name, new_value)
        return old_value
    except Exception as e:
        try:
            obj[attr_name] = new_value
            return old_value
        except Exception as f:
            get_logger().error(PATH_NOT_FOUND, cause=[f, e])


def lower_match(value, candidates):
    return [v for v in candidates if v.lower() == value.lower()]


def dict_to_data(d):
    """
    DO NOT CHECK TYPE
    :param d: dict
    :return: Data
    """
    m = _new(Data)
    _set(m, SLOT, d)
    return m


def list_to_data(v):
    """
    to_data, BUT WITHOUT CHECKS
    """
    output = _new(FlatList)
    output.list = v
    return output


def to_data(v):
    """
    WRAP AS Data OBJECT FOR DATA PROCESSING: https://github.com/klahnakoski/mo-dots/tree/dev/docs
    :param v:  THE VALUE TO WRAP
    :return:  Data INSTANCE
    """

    type_ = _get(v, CLASS)

    if type_ in (dict, OrderedDict):
        m = _new(Data)
        _set(m, SLOT, v)
        return m
    elif type_ is none_type:
        return Null
    elif type_ is list:
        return FlatList(v)
    elif type_ in generator_types:
        return FlatList(list(from_data(vv) for vv in v))
    else:
        return v


wrap = to_data


def leaves_to_data(value):
    """
    dict WITH DOTS IN KEYS IS INTERPRETED AS A PATH
    """
    return to_data(_leaves_to_data(value))


wrap_leaves = leaves_to_data


def _leaves_to_data(value):
    """
    RETURN UNWRAPPED STRUCTURES
    """
    if value == None:
        return None

    class_ = _get(value, CLASS)
    if class_ in (text, binary_type, int, float):
        return value
    if class_ in data_types:
        if class_ is Data:
            value = from_data(value)

        output = {}
        for key, value in value.items():
            value = _leaves_to_data(value)

            if key == "":
                get_logger().error("key is empty string.  Probably a bad idea")
            if is_binary(key):
                key = key.decode("utf8")

            d = output
            if key.find(".") == -1:
                if value is None:
                    d.pop(key, None)
                else:
                    d[key] = value
            else:
                seq = split_field(key)
                for k in seq[:-1]:
                    e = d.get(k, None)
                    if e is None:
                        d[k] = {}
                        e = d[k]
                    d = e
                if value == None:
                    d.pop(seq[-1], None)
                else:
                    d[seq[-1]] = value
        return output
    if hasattr(value, '__iter__'):
        output = []
        for v in value:
            v = leaves_to_data(v)
            output.append(v)
        return output
    return value


def from_data(v):
    if v is None:
        return None
    _type = _get(v, CLASS)
    if _type is NullType:
        return None
    elif _type is Data:
        d = _get(v, SLOT)
        return d
    elif _type is FlatList:
        return v.list
    elif _type is DataObject:
        d = _get(v, OBJ)
        if _get(d, CLASS) in data_types:
            return d
        else:
            return v
    elif _type in generator_types:
        return (from_data(vv) for vv in v)
    else:
        return v


unwrap = from_data


def listwrap(value):
    """
    PERFORMS THE FOLLOWING TRANSLATION
    None -> []
    value -> [value]
    [...] -> [...]  (unchanged list)

    ## MOTIVATION ##
    OFTEN IT IS NICE TO ALLOW FUNCTION PARAMETERS TO BE ASSIGNED A VALUE,
    OR A list-OF-VALUES, OR NULL.  CHECKING FOR WHICH THE CALLER USED IS
    TEDIOUS.  INSTEAD WE CAST FROM THOSE THREE CASES TO THE SINGLE CASE
    OF A LIST

    # BEFORE
    def do_it(a):
        if a is None:
            return
        if not isinstance(a, list):
            a=[a]
        for x in a:
            # do something

    # AFTER
    def do_it(a):
        for x in listwrap(a):
            # do something

    """
    if value == None:
        return FlatList()
    elif is_list(value):
        if isinstance(value, list):
            return list_to_data(value)
        else:
            return value
    elif is_many(value):
        return list_to_data(list(value))
    else:
        return list_to_data([from_data(value)])


def unwraplist(v):
    """
    LISTS WITH ZERO AND ONE element MAP TO None AND element RESPECTIVELY
    """
    if is_list(v):
        if len(v) == 0:
            return None
        elif len(v) == 1:
            return from_data(v[0])
        else:
            return from_data(v)
    else:
        return from_data(v)


def tuplewrap(value):
    """
    INTENDED TO TURN lists INTO tuples FOR USE AS KEYS
    """
    if is_many(value):
        return tuple(tuplewrap(v) if is_sequence(v) else v for v in value)
    return from_data(value),


from mo_dots.datas import Data, SLOT, data_types, is_data
from mo_dots.nones import Null, NullType
from mo_dots.lists import FlatList, is_list, is_sequence, is_container, is_many
from mo_dots.objects import DataObject

# EXPORT
import mo_dots.nones as temp
temp.to_data = to_data
temp.is_sequence = is_sequence
del temp
