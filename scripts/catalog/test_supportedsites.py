#!/usr/bin/env python3
"""Unit tests for supportedsites.py -- stdlib unittest only.

Run as part of the whole package:
    python3 -m unittest discover -s scripts/catalog
"""

from __future__ import annotations

import os
import unittest

import supportedsites as parser


GOLDEN_TR_ID_COUNT = 419
GOLDEN_GROUP_HEADER_COUNT = 31
GOLDEN_SITE_COUNT = 386

DANBOORU_MEMBERS = ["danbooru", "atfbooru", "aibooru", "booruvar"]

KNOWN_FAMILIES = {
    "Danbooru",
    "E621",
    "blogger",
    "booru",
    "chevereto",
    "manga-extractor",
    "mastodon",
    "misskey",
    "moebooru",
    "nitter",
    "philomena",
    "postmill",
    "szurubooru",
    "xenforo",
}


class CleanCellTests(unittest.TestCase):
    def test_strips_span_tags_keeps_text(self) -> None:
        raw = '<span title="https://2ch.org/a/">Boards</span> |\n    <span title="x">Threads</span>'
        self.assertEqual(parser._clean_cell(raw), "Boards | Threads")

    def test_strips_anchor_tags_keeps_link_text(self) -> None:
        raw = '<a href="https://codeberg.org/mikf/gallery-dl#oauth">OAuth</a>'
        self.assertEqual(parser._clean_cell(raw), "OAuth")

    def test_br_becomes_comma_separator(self) -> None:
        raw = "https://civitai.com/<br>https://civitai.red/"
        self.assertEqual(parser._clean_cell(raw), "https://civitai.com/, https://civitai.red/")

    def test_decodes_html_entities(self) -> None:
        self.assertEqual(parser._clean_cell("Tom &amp; Jerry"), "Tom & Jerry")
        self.assertEqual(parser._clean_cell("&lt;script&gt;"), "<script>")

    def test_normalizes_nbsp_and_collapses_whitespace(self) -> None:
        self.assertEqual(parser._clean_cell("API\xa0Key"), "API Key")

    def test_empty_cell(self) -> None:
        self.assertEqual(parser._clean_cell(""), "")


class ParseSupportedsitesUnitTests(unittest.TestCase):
    SAMPLE = """
<table>
<thead valign="bottom">
<tr>
    <th>Site</th>
    <th>URL</th>
    <th>Capabilities</th>
    <th>Authentication</th>
</tr>
</thead>
<tbody valign="top">
<tr id="2ch" title="2ch">
    <td>2ch</td>
    <td>https://2ch.org/</td>
    <td><span title="https://2ch.org/a/">Boards</span> |
        <span title="x">Threads</span></td>
    <td></td>
</tr>
<tr id="Danbooru" title="Danbooru">
    <td colspan="4"><strong>Danbooru Instances</strong></td>
</tr>
<tr id="danbooru" title="danbooru">
    <td>Danbooru</td>
    <td>https://danbooru.donmai.us/</td>
    <td><span title="x">Posts</span></td>
    <td>Supported</td>
</tr>
<tr id="atfbooru" title="atfbooru">
    <td>ATFBooru</td>
    <td>https://booru.allthefallen.moe/</td>
    <td><span title="x">Posts</span></td>
    <td>Supported</td>
</tr>
<tr id="Unmodeled" title="Unmodeled">
    <td colspan="4"><strong>Unmodeled Instances</strong></td>
</tr>
<tr id="unmodeledsite" title="unmodeledsite">
    <td>Unmodeled Site</td>
    <td>https://example.org/</td>
    <td></td>
    <td><a href="https://codeberg.org/mikf/gallery-dl#cookies">Cookies</a></td>
</tr>
</tbody>
</table>
""".strip()

    def test_group_headers_excluded_from_sites(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        keys = [s["k"] for s in result["sites"]]
        self.assertNotIn("Danbooru", keys)
        self.assertNotIn("Unmodeled", keys)

    def test_column_header_row_ignored(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        keys = [s["k"] for s in result["sites"]]
        self.assertNotIn("", keys)
        self.assertEqual(len(result["sites"]), 4)

    def test_2ch_row_parses_fully(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        site = next(s for s in result["sites"] if s["k"] == "2ch")
        self.assertEqual(site["name"], "2ch")
        self.assertEqual(site["url"], "https://2ch.org/")
        self.assertEqual(site["caps"], ["Boards", "Threads"])
        self.assertIsNone(site["auth"])
        self.assertIsNone(site["fam"])

    def test_family_members_recorded_for_every_group(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        self.assertEqual(result["family_members"]["Danbooru"], ["danbooru", "atfbooru"])
        self.assertEqual(result["family_members"]["Unmodeled"], ["unmodeledsite"])

    def test_fam_unfiltered_by_default(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        by_key = {s["k"]: s for s in result["sites"]}
        self.assertEqual(by_key["danbooru"]["fam"], "Danbooru")
        self.assertEqual(by_key["unmodeledsite"]["fam"], "Unmodeled")

    def test_fam_filtered_by_known_families(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE, known_families={"Danbooru"})
        by_key = {s["k"]: s for s in result["sites"]}
        self.assertEqual(by_key["danbooru"]["fam"], "Danbooru")
        self.assertEqual(by_key["atfbooru"]["fam"], "Danbooru")
        # Not in known_families -> fam stays None even though it's grouped.
        self.assertIsNone(by_key["unmodeledsite"]["fam"])

    def test_auth_text_cleaned_and_decoded(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        site = next(s for s in result["sites"] if s["k"] == "unmodeledsite")
        self.assertEqual(site["auth"], "Cookies")

    def test_empty_caps_cell_yields_empty_list(self) -> None:
        result = parser.parse_supportedsites(self.SAMPLE)
        site = next(s for s in result["sites"] if s["k"] == "unmodeledsite")
        self.assertEqual(site["caps"], [])

    def test_empty_id_row_dropped(self) -> None:
        sample = self.SAMPLE.replace(
            '<tr id="unmodeledsite" title="unmodeledsite">',
            '<tr id="" title="">',
        )
        result = parser.parse_supportedsites(sample)
        keys = [s["k"] for s in result["sites"]]
        self.assertNotIn("", keys)
        self.assertEqual(result["family_members"]["Unmodeled"], [])


@unittest.skipUnless(
    os.environ.get("GALLERY_DL_SITES"),
    "set GALLERY_DL_SITES to a supportedsites.md path to run whole-document golden tests",
)
class WholeDocumentGoldenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        source = os.environ["GALLERY_DL_SITES"]
        cls.text = parser.load_text(source)
        cls.result = parser.parse_supportedsites(cls.text, known_families=KNOWN_FAMILIES)

    def test_raw_tr_id_row_count(self) -> None:
        self.assertEqual(self.text.count('<tr id="'), GOLDEN_TR_ID_COUNT)

    def test_group_header_count(self) -> None:
        self.assertEqual(len(self.result["family_members"]), GOLDEN_GROUP_HEADER_COUNT)

    def test_site_count(self) -> None:
        self.assertEqual(len(self.result["sites"]), GOLDEN_SITE_COUNT)

    def test_danbooru_group_header_not_its_own_member(self) -> None:
        self.assertNotIn("Danbooru", self.result["family_members"]["Danbooru"])

    def test_reactor_group_header_id_collides_with_its_own_member_row(self) -> None:
        by_key = {s["k"]: s for s in self.result["sites"]}
        self.assertIn("reactor", by_key)
        self.assertEqual(by_key["reactor"]["name"], "Reactor")
        self.assertIn("reactor", self.result["family_members"]["reactor"])

    def test_danbooru_row_parses_fully(self) -> None:
        by_key = {s["k"]: s for s in self.result["sites"]}
        danbooru = by_key["danbooru"]
        self.assertEqual(danbooru["name"], "Danbooru")
        self.assertEqual(danbooru["url"], "https://danbooru.donmai.us/")
        self.assertIn("Posts", danbooru["caps"])
        self.assertIn("Tag Searches", danbooru["caps"])
        self.assertEqual(danbooru["auth"], "Supported")
        self.assertEqual(danbooru["fam"], "Danbooru")

    def test_family_members_danbooru(self) -> None:
        self.assertEqual(self.result["family_members"]["Danbooru"], DANBOORU_MEMBERS)

    def test_entity_and_nbsp_decoding(self) -> None:
        by_key = {s["k"]: s for s in self.result["sites"]}
        self.assertEqual(by_key["wallhaven"]["auth"], "API Key")
        self.assertNotIn("\xa0", by_key["wallhaven"]["auth"])


if __name__ == "__main__":
    unittest.main()
