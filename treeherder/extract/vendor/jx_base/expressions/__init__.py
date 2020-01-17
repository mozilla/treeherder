from jx_base.expressions._utils import simplified, extend, jx_expression, merge_types, operators, language, _jx_expression
from jx_base.expressions.abs_op import AbsOp
from jx_base.expressions.add_op import AddOp
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.base_binary_op import BaseBinaryOp
from jx_base.expressions.base_inequality_op import BaseInequalityOp
from jx_base.expressions.base_multi_op import BaseMultiOp
from jx_base.expressions.basic_add_op import BasicAddOp
from jx_base.expressions.basic_eq_op import BasicEqOp
from jx_base.expressions.basic_index_of_op import BasicIndexOfOp
from jx_base.expressions.basic_mul_op import BasicMulOp
from jx_base.expressions.basic_multi_op import BasicMultiOp
from jx_base.expressions.basic_starts_with_op import BasicStartsWithOp
from jx_base.expressions.basic_substring_op import BasicSubstringOp
from jx_base.expressions.between_op import BetweenOp
from jx_base.expressions.boolean_op import BooleanOp
from jx_base.expressions.case_op import CaseOp
from jx_base.expressions.coalesce_op import CoalesceOp
from jx_base.expressions.concat_op import ConcatOp
from jx_base.expressions.count_op import CountOp
from jx_base.expressions.date_op import DateOp
from jx_base.expressions.div_op import DivOp
from jx_base.expressions.eq_op import EqOp
from jx_base.expressions.es_nested_op import EsNestedOp
from jx_base.expressions.es_script import EsScript
from jx_base.expressions.exists_op import ExistsOp
from jx_base.expressions.exp_op import ExpOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FalseOp, FALSE
from jx_base.expressions.find_op import FindOp
from jx_base.expressions.first_op import FirstOp
from jx_base.expressions.floor_op import FloorOp
from jx_base.expressions.from_unix_op import FromUnixOp
from jx_base.expressions.get_op import GetOp
from jx_base.expressions.gt_op import GtOp
from jx_base.expressions.gte_op import GteOp
from jx_base.expressions.in_op import InOp
from jx_base.expressions.integer_op import IntegerOp
from jx_base.expressions.is_boolean_op import IsBooleanOp
from jx_base.expressions.is_integer_op import IsIntegerOp
from jx_base.expressions.is_number_op import IsNumberOp
from jx_base.expressions.is_string_op import IsStringOp
from jx_base.expressions.last_op import LastOp
from jx_base.expressions.leaves_op import LeavesOp
from jx_base.expressions.left_op import LeftOp
from jx_base.expressions.length_op import LengthOp
from jx_base.expressions.literal import Literal, ONE, ZERO, register_literal, is_literal
from jx_base.expressions.lt_op import LtOp
from jx_base.expressions.lte_op import LteOp
from jx_base.expressions.max_op import MaxOp
from jx_base.expressions.min_op import MinOp
from jx_base.expressions.missing_op import MissingOp
from jx_base.expressions.mod_op import ModOp
from jx_base.expressions.mul_op import MulOp
from jx_base.expressions.ne_op import NeOp
from jx_base.expressions.not_left_op import NotLeftOp
from jx_base.expressions.not_op import NotOp
from jx_base.expressions.not_right_op import NotRightOp
from jx_base.expressions.null_op import NullOp, NULL
from jx_base.expressions.number_op import NumberOp
from jx_base.expressions.offset_op import OffsetOp
from jx_base.expressions.or_op import OrOp
from jx_base.expressions.prefix_op import PrefixOp
from jx_base.expressions.python_script import PythonScript
from jx_base.expressions.query_op import QueryOp
from jx_base.expressions.range_op import RangeOp
from jx_base.expressions.reg_exp_op import RegExpOp
from jx_base.expressions.right_op import RightOp
from jx_base.expressions.rows_op import RowsOp
from jx_base.expressions.script_op import ScriptOp
from jx_base.expressions.select_op import SelectOp
from jx_base.expressions.split_op import SplitOp
from jx_base.expressions.sql_eq_op import SqlEqOp
from jx_base.expressions.sql_instr_op import SqlInstrOp
from jx_base.expressions.sql_script import SQLScript
from jx_base.expressions.sql_substr_op import SqlSubstrOp
from jx_base.expressions.string_op import StringOp
from jx_base.expressions.sub_op import SubOp
from jx_base.expressions.suffix_op import SuffixOp
from jx_base.expressions.true_op import TrueOp, TRUE
from jx_base.expressions.tuple_op import TupleOp
from jx_base.expressions.union_op import UnionOp
from jx_base.expressions.unix_op import UnixOp
from jx_base.expressions.variable import Variable, IDENTITY
from jx_base.expressions.when_op import WhenOp
from mo_dots import set_default

set_default(operators, {
    "abs": AbsOp,
    "add": AddOp,
    "and": AndOp,
    "basic.add": BasicAddOp,
    "basic.mul": BasicMulOp,
    "between": BetweenOp,
    "case": CaseOp,
    "coalesce": CoalesceOp,
    "concat": ConcatOp,
    "count": CountOp,
    "date": DateOp,
    "div": DivOp,
    "divide": DivOp,
    "eq": EqOp,
    "exists": ExistsOp,
    "exp": ExpOp,
    "find": FindOp,
    "first": FirstOp,
    "floor": FloorOp,
    "from_unix": FromUnixOp,
    "get": GetOp,
    "gt": GtOp,
    "gte": GteOp,
    "in": InOp,
    "instr": FindOp,
    "is_number": IsNumberOp,
    "is_string": IsStringOp,
    "last": LastOp,
    "left": LeftOp,
    "length": LengthOp,
    "literal": Literal,
    "lt": LtOp,
    "lte": LteOp,
    "match_all": TrueOp,
    "max": MaxOp,
    "minus": SubOp,
    "missing": MissingOp,
    "mod": ModOp,
    "mul": MulOp,
    "mult": MulOp,
    "multiply": MulOp,
    "ne": NeOp,
    "neq": NeOp,
    "not": NotOp,
    "not_left": NotLeftOp,
    "not_right": NotRightOp,
    "null": NullOp,
    "number": NumberOp,
    "offset": OffsetOp,
    "or": OrOp,
    "postfix": SuffixOp,
    "prefix": PrefixOp,
    "range": RangeOp,
    "regex": RegExpOp,
    "regexp": RegExpOp,
    "right": RightOp,
    "rows": RowsOp,
    "script": ScriptOp,
    "select": SelectOp,
    "split": SplitOp,
    "string": StringOp,
    "suffix": SuffixOp,
    "sub": SubOp,
    "subtract": SubOp,
    "sum": AddOp,
    "term": EqOp,
    "terms": InOp,
    "tuple": TupleOp,
    "union": UnionOp,
    "unix": UnixOp,
    "when": WhenOp,
})

language.register_ops(vars())

register_literal(NullOp)
register_literal(FalseOp)
register_literal(TrueOp)
register_literal(DateOp)
register_literal(Literal)

