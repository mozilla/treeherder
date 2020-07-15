# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#

from __future__ import absolute_import, division, unicode_literals

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

from mo_dots import Data, to_data, dict_to_data
from mo_json import value2json, json2value
from mo_math import bytes2base64, base642bytes, int2base64, base642int


SHA256 = hashes.SHA256()
PSS  = padding.PSS(
    mgf=padding.MGF1(SHA256), salt_length=padding.PSS.MAX_LENGTH
)
PADDING = {
    "PSS": PSS
}
ALGORITHM = {
    "SHA256": SHA256
}

BACKEND = default_backend()


def generate_key(bits=512):
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=bits,
        backend=BACKEND
    )
    nums = private_key.public_key().public_numbers()
    public_key = Data(e=nums.e, n=int2base64(nums.n))
    return public_key, private_key


def sign(message, private_key):
    data = value2json(message).encode("utf8")

    # SIGN DATA/STRING
    signature = private_key.sign(data=data, padding=PSS, algorithm=SHA256)

    return dict_to_data({
        "data": bytes2base64(data),
        "signature": bytes2base64(signature),
        "padding": "PSS",
        "algorithm=": "SHA256"
    })


def verify(signed, public_key):
    data = base642bytes(signed.data)
    signature = base642bytes(signed.signature)

    key = RSAPublicNumbers(
        public_key.e,
        base642int(public_key.n)
    ).public_key(BACKEND)

    key.verify(
        signature=signature,
        data=data,
        padding=PADDING.get(signed.padding, PSS),
        algorithm=ALGORITHM.get(signed.algorithm, SHA256),
    )

    return json2value(data.decode("utf8"))
