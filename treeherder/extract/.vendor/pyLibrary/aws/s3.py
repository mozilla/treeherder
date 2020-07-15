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

import gzip
import zipfile

import boto
from boto.s3.connection import Location
from bs4 import BeautifulSoup

import mo_files
from mo_dots import Data, Null, coalesce, unwrap, to_data, is_many, list_to_data
from mo_files import mimetype
from mo_files.url import value2url_param
from mo_future import StringIO, is_binary, text
from mo_http import http
from mo_http.big_data import (
    LazyLines,
    MAX_STRING_SIZE,
    ibytes2ilines,
    safe_size,
    scompressed2ibytes,
)
from mo_kwargs import override
from mo_logs import Except, Log
from mo_testing.fuzzytestcase import assertAlmostEqual
from mo_times.dates import Date
from mo_times.timer import Timer
from pyLibrary import convert

VERIFY_UPLOAD = True
DEBUG = False
TOO_MANY_KEYS = 1000 * 1000 * 1000
READ_ERROR = "S3 read error"
MAX_FILE_SIZE = 100 * 1024 * 1024
VALID_KEY = r"\d+([.:]\d+)*"
KEY_IS_WRONG_FORMAT = "key {{key}} in bucket {{bucket}} is of the wrong format"


class File(object):
    def __init__(self, bucket, key):
        self.bucket = bucket
        self.key = key

    def read(self):
        return self.bucket.read(self.key)

    def read_lines(self):
        return self.bucket.read_lines(self.key)

    def write(self, value):
        self.bucket.write(self.key, value)

    def write_lines(self, lines):
        self.bucket.write_lines(self.key, lines)

    @property
    def meta(self):
        return self.bucket.meta(self.key)

    def delete(self):
        return self.bucket.delete_key(self.key)


class Connection(object):
    @override
    def __init__(
        self,
        aws_access_key_id=None,  # CREDENTIAL
        aws_secret_access_key=None,  # CREDENTIAL
        region=None,  # NAME OF AWS REGION, REQUIRED FOR SOME BUCKETS
        kwargs=None,
    ):
        self.settings = kwargs

        try:
            if not kwargs.region:
                self.connection = boto.connect_s3(
                    aws_access_key_id=unwrap(self.settings.aws_access_key_id),
                    aws_secret_access_key=unwrap(self.settings.aws_secret_access_key),
                )
            else:
                self.connection = boto.s3.connect_to_region(
                    self.settings.region,
                    aws_access_key_id=unwrap(self.settings.aws_access_key_id),
                    aws_secret_access_key=unwrap(self.settings.aws_secret_access_key),
                )
        except Exception as e:
            Log.error("Problem connecting to S3", e)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.connection:
            self.connection.close()

    def get_bucket(self, name):
        output = SkeletonBucket()
        output.bucket = self.connection.get_bucket(name, validate=False)
        return output


class Bucket(object):
    """
    STORE JSON, OR CR-DELIMITED LIST OF JSON, IN S3
    THIS CLASS MANAGES THE ".json" EXTENSION, AND ".gz"
    (ZIP/UNZIP) SHOULD THE FILE BE BIG ENOUGH TO
    JUSTIFY IT

    ALL KEYS ARE DIGITS, SEPARATED BY DOT (.) COLON (:)
    """

    @override
    def __init__(
        self,
        bucket,  # NAME OF THE BUCKET
        aws_access_key_id=None,  # CREDENTIAL
        aws_secret_access_key=None,  # CREDENTIAL
        region=None,  # NAME OF AWS REGION, REQUIRED FOR SOME BUCKETS
        public=False,
        debug=False,
        kwargs=None,
    ):
        self.settings = kwargs
        self.connection = None
        self.bucket = None
        self.key_format = _scrub_key(kwargs.key_format)

        try:
            self.connection = Connection(kwargs).connection
            self.bucket = self.connection.get_bucket(
                self.settings.bucket, validate=False
            )
        except Exception as e:
            Log.error(
                "Problem connecting to {{bucket}}", bucket=self.settings.bucket, cause=e
            )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.connection:
            self.connection.close()

    def __getattr__(self, item):
        return getattr(self.bucket, item)

    def get_key(self, key, must_exist=True):
        if must_exist:
            meta = self.get_meta(key)
            if not meta:
                Log.error(
                    "Key {{key}} does not exist in bucket {{bucket}}",
                    key=key,
                    bucket=self.bucket.name,
                )
            key = strip_extension(meta.key)
        return File(self, key)

    def delete_key(self, key):
        # self._verify_key_format(key)  DO NOT VERIFY, DELETE BAD KEYS ANYWAY!!
        try:
            meta = self.get_meta(key, conforming=False)
            if meta == None:
                return
            self.bucket.delete_key(meta.key)
        except Exception as e:
            self.get_meta(key, conforming=False)
            raise e

    def delete_keys(self, keys):
        self.bucket.delete_keys([str(k) for k in keys])

    def get_meta(self, key, conforming=True):
        """
        RETURN METADATA ON FILE IN BUCKET
        :param key:  KEY, OR PREFIX OF KEY
        :param conforming: TEST IF THE KEY CONFORMS TO REQUIRED PATTERN
        :return: METADATA, IF UNIQUE, ELSE ERROR
        """
        try:
            metas = list(self.bucket.list(prefix=str(key)))
            metas = list_to_data([m for m in metas if text(m.name).find(".json") != -1])

            perfect = Null
            favorite = Null
            too_many = False
            error = None
            for m in metas:
                try:
                    simple = strip_extension(m.key)
                    if conforming:
                        self._verify_key_format(simple)
                    if simple == key:
                        perfect = m
                        too_many = False
                    if simple.startswith(key + ".") or simple.startswith(key + ":"):
                        if favorite and not perfect:
                            too_many = True
                        favorite = m
                except Exception as e:
                    error = e

            if too_many:
                Log.error(
                    "multiple keys in {{bucket}} with prefix={{prefix|quote}}: {{list}}",
                    bucket=self.name,
                    prefix=key,
                    list=[k.name for k in metas],
                )
            if not perfect and error:
                Log.error("Problem with key request", error)
            return coalesce(perfect, favorite)
        except Exception as e:
            Log.error(
                READ_ERROR + " can not read {{key}} from {{bucket}}",
                key=key,
                bucket=self.bucket.name,
                cause=e,
            )

    def keys(self, prefix=None, delimiter=None):
        """
        :param prefix:  NOT A STRING PREFIX, RATHER PATH ID PREFIX (MUST MATCH TO NEXT "." OR ":")
        :param delimiter:  TO GET Prefix OBJECTS, RATHER THAN WHOLE KEYS
        :return: SET OF KEYS IN BUCKET, OR
        """
        if delimiter:
            # WE REALLY DO NOT GET KEYS, BUT RATHER Prefix OBJECTS
            # AT LEAST THEY ARE UNIQUE
            candidates = [
                k.name.rstrip(delimiter)
                for k in self.bucket.list(prefix=str(prefix), delimiter=str(delimiter))
            ]
        else:
            candidates = [
                strip_extension(k.key) for k in self.bucket.list(prefix=str(prefix))
            ]

        if prefix == None:
            return set(c for c in candidates if c != "0.json")
        else:
            return set(
                k
                for k in candidates
                if k == prefix
                or k.startswith(prefix + ".")
                or k.startswith(prefix + ":")
            )

    def metas(self, prefix=None, limit=None, delimiter=None):
        """
        RETURN THE METADATA DESCRIPTORS FOR EACH KEY
        """
        limit = coalesce(limit, TOO_MANY_KEYS)
        keys = self.bucket.list(prefix=str(prefix), delimiter=str(delimiter))
        prefix_len = len(prefix)
        output = []
        for i, k in enumerate(
            k
            for k in keys
            if len(k.key) == prefix_len or k.key[prefix_len] in [".", ":"]
        ):
            output.append(
                {
                    "key": strip_extension(k.key),
                    "etag": convert.quote2string(k.etag),
                    "expiry_date": Date(k.expiry_date),
                    "last_modified": Date(k.last_modified),
                }
            )
            if i >= limit:
                break
        return to_data(output)

    def read(self, key):
        source = self.get_meta(key)

        try:
            json = safe_size(source)
        except Exception as e:
            Log.error(READ_ERROR, e)

        if json == None:
            return None

        if source.key.endswith(".zip"):
            json = _unzip(json)
        elif source.key.endswith(".gz"):
            json = convert.zip2bytes(json)

        return json.decode("utf8")

    def read_bytes(self, key):
        source = self.get_meta(key)
        return safe_size(source)

    def read_lines(self, key):
        source = self.get_meta(key)
        if source is None:
            Log.error("{{key}} does not exist", key=key)
        elif source.key.endswith(".gz"):
            return LazyLines(ibytes2ilines(scompressed2ibytes(source)))
        elif source.size < MAX_STRING_SIZE:
            return source.read().decode("utf8").split("\n")
        else:
            return LazyLines(source)

    def write(self, key, value, disable_zip=False):
        if key.endswith(".json") or key.endswith(".zip"):
            Log.error("Expecting a pure key")

        try:
            if hasattr(value, "read"):
                if disable_zip:
                    storage = self.bucket.new_key(str(key + ".json"))
                    string_length = len(value)
                    headers = {"Content-Type": mimetype.JSON}
                else:
                    storage = self.bucket.new_key(str(key + ".json.gz"))
                    string_length = len(value)
                    value = convert.bytes2zip(value)
                    headers = {"Content-Type": mimetype.GZIP}
                file_length = len(value)
                Log.note(
                    "Sending contents with length {{file_length|comma}} (from string with length {{string_length|comma}})",
                    file_length=file_length,
                    string_length=string_length,
                )
                value.seek(0)
                storage.set_contents_from_file(value, headers=headers)

                if self.settings.public:
                    storage.set_acl("public-read")
                return

            if len(value) > 20 * 1000 and not disable_zip:
                self.bucket.delete_key(str(key + ".json"))
                self.bucket.delete_key(str(key + ".json.gz"))
                if is_binary(value):
                    value = convert.bytes2zip(value)
                    key += ".json.gz"
                else:
                    value = convert.bytes2zip(value).encode("utf8")
                    key += ".json.gz"
                headers = {"Content-Type": mimetype.GZIP}
            else:
                self.bucket.delete_key(str(key + ".json.gz"))
                if is_binary(value):
                    key += ".json"
                else:
                    key += ".json"
                headers = {"Content-Type": mimetype.JSON}

            storage = self.bucket.new_key(str(key))
            storage.set_contents_from_string(value, headers=headers)

            if self.settings.public:
                storage.set_acl("public-read")
        except Exception as e:
            Log.error(
                "Problem writing {{bytes}} bytes to {{key}} in {{bucket}}",
                key=key,
                bucket=self.bucket.name,
                bytes=len(value),
                cause=e,
            )

    def write_lines(self, key, lines):
        self._verify_key_format(key)
        storage = self.bucket.new_key(str(key + ".json.gz"))

        if VERIFY_UPLOAD:
            lines = list(lines)

        with mo_files.TempFile() as tempfile:
            with open(tempfile.abspath, "wb") as buff:
                DEBUG and Log.note("Temp file {{filename}}", filename=tempfile.abspath)
                archive = gzip.GzipFile(filename=str(key + ".json"), fileobj=buff, mode="w")
                count = 0
                for l in lines:
                    if is_many(l):
                        for ll in l:
                            archive.write(ll.encode("utf8"))
                            archive.write(b"\n")
                            count += 1
                    else:
                        archive.write(l.encode("utf8"))
                        archive.write(b"\n")
                        count += 1
                archive.close()

            retry = 3
            while retry:
                try:
                    with Timer(
                        "Sending {{count}} lines in {{file_length|comma}} bytes for {{key}}",
                        {"key": key, "file_length": tempfile.length, "count": count},
                        verbose=self.settings.debug,
                    ):
                        storage.set_contents_from_filename(
                            tempfile.abspath, headers={"Content-Type": mimetype.GZIP}
                        )
                    break
                except Exception as e:
                    e = Except.wrap(e)
                    retry -= 1
                    if (
                        retry == 0
                        or "Access Denied" in e
                        or "No space left on device" in e
                    ):
                        Log.error("could not push data to s3", cause=e)
                    else:
                        Log.warning("could not push data to s3, will retry", cause=e)

            if self.settings.public:
                storage.set_acl("public-read")

            if VERIFY_UPLOAD:
                try:
                    with open(tempfile.abspath, mode="rb") as source:
                        result = list(ibytes2ilines(scompressed2ibytes(source)))
                        assertAlmostEqual(result, lines, msg="file is different")

                    # full_url = "https://"+self.name+".s3-us-west-2.amazonaws.com/"+storage.key.replace(":", "%3A")
                    # https://active-data-test-result.s3-us-west-2.amazonaws.com/tc.1524896%3A152488763.0.json.gz

                    # dest_bucket = s3.MultiBucket(bucket="self.name", kwargs=self.settings.aws)

                    result = list(self.read_lines(strip_extension(key)))
                    assertAlmostEqual(result, lines, result, msg="S3 is different")

                except Exception as e:
                    from activedata_etl.transforms import TRY_AGAIN_LATER

                    Log.error(TRY_AGAIN_LATER, reason="did not pass verification", cause=e)
        return

    @property
    def name(self):
        return self.settings.bucket

    def _verify_key_format(self, key):
        if self.key_format == None:
            return

        if self.key_format != _scrub_key(key):
            Log.error(KEY_IS_WRONG_FORMAT, key=key, bucket=self.bucket.name)


class SkeletonBucket(Bucket):
    """
    LET CALLER WORRY ABOUT SETTING PROPERTIES
    """

    def __init__(self):
        object.__init__(self)
        self.connection = None
        self.bucket = None
        self.key_format = None


content_keys = {
    "key": text,
    "lastmodified": Date,
    "etag": text,
    "size": int,
    "storageclass": text,
}


class PublicBucket(object):
    """
    USE THE https PUBLIC API TO INTERACT WITH A BUCKET
    MAYBE boto CAN DO THIS, BUT NO DOCS FOUND
    """

    @override
    def __init__(self, url, kwargs=None):
        self.url = url

    def list(self, prefix=None, marker=None, delimiter=None):
        # https://s3.amazonaws.com/net-mozaws-stage-fx-test-activedata?marker=jenkins-go-bouncer.prod-3019/py27.log
        # <ListBucketResult>
        #     <Name>net-mozaws-stage-fx-test-activedata</Name>
        #     <Prefix/>
        #     <Marker>jenkins-go-bouncer.prod-3019/py27.log</Marker>
        #     <MaxKeys>1000</MaxKeys>
        #     <IsTruncated>true</IsTruncated>
        #     <Contents>
        #         <Key>jenkins-go-bouncer.prod-3020/py27.log</Key>
        #         <LastModified>2017-03-05T07:02:20.000Z</LastModified>
        #         <ETag>"69dcb19e91eb3eec51e1b659801523d6"</ETag>
        #         <Size>10037</Size>
        #         <StorageClass>STANDARD</StorageClass>
        state = Data()
        state.prefix = prefix
        state.delimiter = delimiter
        state.marker = marker
        state.get_more = True

        def more():
            xml = http.get(self.url + "?" + value2url_param(state)).content
            data = BeautifulSoup(xml, "xml")

            state.get_more = data.find("istruncated").contents[0] == "true"
            contents = data.findAll("contents")
            if len(contents):
                state.marker = contents[-1].find("key").contents[0]
            return [
                {k: t(d.find(k).contents[0]) for k, t in content_keys.items()}
                for d in contents
            ]

        while state.get_more:
            content = more()
            for c in content:
                yield to_data(c)

    def read_lines(self, key):
        url = self.url + "/" + key
        return http.get(url).all_lines


def strip_extension(key):
    key = text(key)
    e = key.find(".json")
    if e == -1:
        return key
    return key[:e]


def _unzip(compressed):
    buff = StringIO(compressed)
    archive = zipfile.ZipFile(buff, mode="r")
    return archive.read(archive.namelist()[0])


def _scrub_key(key):
    """
    RETURN JUST THE :. CHARACTERS
    """
    if key == None:
        return None

    output = []
    for c in key:
        if c in [":", "."]:
            output.append(c)
    return "".join(output)


def key_prefix(key):
    return int(key.split(":")[0].split(".")[0])
