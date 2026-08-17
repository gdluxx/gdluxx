#!/usr/bin/env python3
"""Unit tests for gallery_dl_rst_to_json.py -- stdlib unittest only.

Run as part of the whole package:
    python3 -m unittest discover -s scripts/catalog
"""

from __future__ import annotations

import os
import unittest

import gallery_dl_rst_to_json as parser


GOLDEN_ENTRY_COUNT = 699


def _by_name(result: dict) -> dict:
    names: dict[str, dict] = {}
    for entry in result["entries"]:
        for name in entry["names"]:
            names[name] = entry
    return names


class StripLineBlockTests(unittest.TestCase):
    def test_drops_leading_marker(self) -> None:
        out = parser.strip_line_block(['| A string of characters'])
        self.assertEqual(out, ['  A string of characters'])
        self.assertEqual(out[0].strip(), 'A string of characters')

    def test_bare_pipe_becomes_blank(self) -> None:
        out = parser.strip_line_block(['|'])
        self.assertEqual(out[0].strip(), '')

    def test_non_marker_lines_untouched(self) -> None:
        lines = ['Plain text', '    Indented text', '* A bullet']
        self.assertEqual(parser.strip_line_block(lines), lines)

    def test_preserves_column_position_for_nested_bodies(self) -> None:
        lines = [
            '``"info"`` | ``"web_profile_info"``',
            '    | Use web_profile_info results',
            '    | (may be slow)',
            '``"web"`` | ``"webpage"``',
            '    Extract from the webpage',
        ]
        out = parser.strip_line_block(lines)
        self.assertGreater(len(out[1]) - len(out[1].lstrip()), 0)
        self.assertGreater(len(out[2]) - len(out[2].lstrip()), 0)
        self.assertEqual(out[0], lines[0])
        self.assertEqual(out[3], lines[3])

    def test_bullet_wrapped_line_block_keeps_bullet_marker(self) -> None:
        out = parser.strip_line_block(['* | A pair, separated by a colon.'])
        self.assertTrue(out[0].lstrip().startswith('*'))
        self.assertNotIn('|', out[0])

    def test_idempotent(self) -> None:
        lines = [
            '| Starting this value with a +',
            '  will use the latest preset target,',
            '| (Supported values: a | b | c)',
            '* | A wrapped bullet verse',
            '  | continuing here',
            'Plain trailing line.',
        ]
        once = parser.strip_line_block(lines)
        twice = parser.strip_line_block(once)
        self.assertEqual(once, twice)


class SplitNestedDeflistTests(unittest.TestCase):
    RAW = "\n".join([
        "This option controls behavior.",
        "",
        "See details below for each mode.",
        "",
        '``"a"`` | ``"alpha"``',
        "    Use alpha results",
        '``"b"`` | ``"beta"``',
        "    | Use beta results",
        "    | (may be slow)",
        '``"c"`` | ``"gamma"``',
        "    Use gamma results",
        "",
    ])

    def test_preface_and_terms(self) -> None:
        preface, terms = parser.split_nested_deflist(self.RAW)
        self.assertEqual(
            preface,
            "This option controls behavior.\n\nSee details below for each mode.",
        )
        self.assertEqual(len(terms), 3)
        self.assertEqual(terms[0]["term"], '``"a"`` | ``"alpha"``')
        self.assertEqual(terms[0]["definition"], "Use alpha results")
        self.assertEqual(terms[2]["term"], '``"c"`` | ``"gamma"``')
        self.assertEqual(terms[2]["definition"], "Use gamma results")

    def test_nested_line_block_body_does_not_swallow_next_term(self) -> None:
        _preface, terms = parser.split_nested_deflist(
            "\n".join(parser.strip_line_block(self.RAW.splitlines()))
        )
        self.assertEqual(len(terms), 3)
        self.assertEqual(terms[1]["term"], '``"b"`` | ``"beta"``')
        self.assertIn("Use beta results", terms[1]["definition"])
        self.assertIn("may be slow", terms[1]["definition"])
        self.assertNotIn("gamma", terms[1]["definition"])

    def test_bullet_items_are_not_terms(self) -> None:
        raw = "\n".join([
            "This can be",
            "",
            "* The path of a plaintext file",
            "  containing names separated by newlines",
            "* A string with names separated by commas",
        ])
        preface, terms = parser.split_nested_deflist(raw)
        self.assertEqual(terms, [])
        self.assertIn("plaintext file", preface)
        self.assertIn("separated by commas", preface)

    def test_no_terms_returns_whole_text_as_preface(self) -> None:
        raw = "Just a plain sentence.\n\nAnother paragraph."
        preface, terms = parser.split_nested_deflist(raw)
        self.assertEqual(preface, raw)
        self.assertEqual(terms, [])


class ParseValueSetTests(unittest.TestCase):
    def test_structured_terms(self) -> None:
        raw = "\n".join([
            '``"auto"``',
            "    Use characters from unix or windows",
            "    depending on the local operating system",
            '``"unix"``',
            '    ``"/"``',
        ])
        result = parser.parse_value_set(raw)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["value"], '"auto"')
        self.assertIn("operating system", result[0]["description"])
        self.assertEqual(result[1]["value"], '"unix"')
        self.assertEqual(result[1]["description"], '"/"')

    def test_flat_literal_list_falls_back_to_empty_description(self) -> None:
        raw = "* ``gallery``\n* ``posts``\n* ``followers``"
        result = parser.parse_value_set(raw)
        self.assertEqual(
            result,
            [
                {"value": "gallery", "description": ""},
                {"value": "posts", "description": ""},
                {"value": "followers", "description": ""},
            ],
        )

    def test_empty_input(self) -> None:
        self.assertEqual(parser.parse_value_set(""), [])


class ParseDefaultMatrixTests(unittest.TestCase):
    def test_pipe_separated_literal_runs(self) -> None:
        raw = "\n".join([
            '``"0.5-1.5"``',
            "    ``ao3``             |",
            "    ``arcalive``        |",
            "    ``artfight``",
            '``"1.0"``',
            "    ``animepictures``",
            '``0``',
            "    otherwise",
        ])
        rows = parser.parse_default_matrix(raw)
        self.assertIsNotNone(rows)
        assert rows is not None
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["value"], '"0.5-1.5"')
        self.assertTrue(rows[0]["parsed"])
        self.assertEqual(rows[0]["value_parsed"], "0.5-1.5")
        self.assertEqual(rows[0]["sites"], ["ao3", "arcalive", "artfight"])
        self.assertEqual(rows[1]["sites"], ["animepictures"])
        self.assertEqual(rows[2]["value"], "0")
        self.assertEqual(rows[2]["value_parsed"], 0)
        self.assertEqual(rows[2]["sites"], [])

    def test_mixed_prose_and_literals_in_one_row_bails(self) -> None:
        raw = "\n".join([
            '``"a"``',
            "    ``site1`` and some other prose too",
            '``"b"``',
            "    ``site2``",
        ])
        self.assertIsNone(parser.parse_default_matrix(raw))

    def test_no_nested_terms_returns_none(self) -> None:
        self.assertIsNone(parser.parse_default_matrix('``"desc"``'))

    def test_all_prose_rows_return_none(self) -> None:
        raw = "\n".join([
            '``"a"``',
            "    some prose only",
            '``"b"``',
            "    more prose only",
        ])
        self.assertIsNone(parser.parse_default_matrix(raw))

    def test_empty_input(self) -> None:
        self.assertIsNone(parser.parse_default_matrix(""))


@unittest.skipUnless(
    os.environ.get("GALLERY_DL_RST"),
    "set GALLERY_DL_RST to a configuration.rst path to run whole-document golden tests",
)
class WholeDocumentGoldenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        source = os.environ["GALLERY_DL_RST"]
        text = parser.load_text(source)
        cls.result = parser.parse_document(text)
        cls.errors, cls.warnings = parser.validate(cls.result)
        cls.by_name = _by_name(cls.result)

    def test_entry_count(self) -> None:
        self.assertEqual(self.result["entry_count"], GOLDEN_ENTRY_COUNT)
        self.assertEqual(len(self.result["entries"]), GOLDEN_ENTRY_COUNT)

    def test_zero_validation_errors(self) -> None:
        self.assertEqual(self.errors, [])

    def test_golden_itaku_order(self) -> None:
        entry = self.by_name["extractor.itaku.order"]
        self.assertEqual(
            entry["description"],
            "Controls the order in which images/posts/users are returned.",
        )
        terms = entry["description_terms"]
        self.assertEqual(len(terms), 3)
        self.assertEqual(terms[0]["term"], '"asc" | "reverse"')
        self.assertEqual(terms[0]["definition"], "Ascending order (oldest first)")
        self.assertEqual(terms[1]["term"], '"desc"')
        self.assertEqual(terms[1]["definition"], "Descending order (newest first)")
        self.assertEqual(terms[2]["term"], "any other string")
        self.assertEqual(terms[2]["definition"], "Custom result order")

    def test_golden_path_restrict(self) -> None:
        entry = self.by_name["extractor.*.path-restrict"]
        self.assertNotIn(" | ", entry["description"])
        self.assertNotIn("description_terms", entry)
        detail = entry["value_sets_detail"]["Special Values"]
        self.assertEqual(len(detail), 6)
        values = [row["value"] for row in detail]
        self.assertEqual(
            values,
            ['"auto"', '"unix"', '"windows"', '"windows+"', '"ascii"', '"ascii+"'],
        )
        for row in detail:
            self.assertTrue(row["description"])

    def test_golden_sleep_request(self) -> None:
        entry = self.by_name["extractor.*.sleep-request"]
        self.assertFalse(entry["default"]["parsed"])
        matrix = entry["default"]["matrix"]
        self.assertGreaterEqual(len(matrix), 8)
        first = matrix[0]
        self.assertEqual(first["value"], '"0.5-1.5"')
        self.assertEqual(first["value_parsed"], "0.5-1.5")
        self.assertIn("ao3", first["sites"])
        self.assertIn("arcalive", first["sites"])
        for row in matrix:
            for site in row["sites"]:
                self.assertNotIn(" ", site.strip())


if __name__ == "__main__":
    unittest.main()
