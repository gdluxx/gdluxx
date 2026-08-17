#!/usr/bin/env python3
"""Parse gallery-dl's docs/supportedsites.md into a site roster + family map.

    python3 scripts/catalog/supportedsites.py
    python3 scripts/catalog/supportedsites.py /path/to/supportedsites.md
    python3 scripts/catalog/supportedsites.py <url> -o sites.json
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Iterable, Iterator

# Pinned to the same tag as build_catalog.py's configuration.rst source --
# see that file's version-pin comment for the bump procedure.
GALLERY_DL_VERSION = "1.32.9"
SOURCE_REF = f"v{GALLERY_DL_VERSION}"
DEFAULT_SOURCE_URL = (
    f"https://codeberg.org/mikf/gallery-dl/raw/tag/{SOURCE_REF}/docs/supportedsites.md"
)

_URL_RE = re.compile(r"^https?://")
_TR_RE = re.compile(r"<tr\b([^>]*)>(.*?)</tr>", re.S)
_ID_RE = re.compile(r'\bid="([^"]*)"')
_TD_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_BR_RE = re.compile(r"<br\s*/?>", re.I)
_TAG_RE = re.compile(r"<[^>]+>")


def load_text(source: str) -> str:
    if _URL_RE.match(source):
        req = urllib.request.Request(
            source, headers={"User-Agent": "gdluxx-catalog-build/1"}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read().decode("utf-8")
    return Path(source).read_text(encoding="utf-8")


def _clean_cell(raw: str) -> str:
    text = _BR_RE.sub(", ", raw)
    text = _TAG_RE.sub("", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def _iter_id_rows(text: str) -> Iterator[tuple[str, str]]:
    for match in _TR_RE.finditer(text):
        attrs, body = match.group(1), match.group(2)
        id_match = _ID_RE.search(attrs)
        if id_match is not None and id_match.group(1):
            yield id_match.group(1), body


def _is_group_header(body: str) -> bool:
    return "colspan" in body


def _parse_site_row(row_id: str, body: str) -> dict[str, Any]:
    cells = _TD_RE.findall(body)
    name = _clean_cell(cells[0]) if len(cells) > 0 else ""
    url = _clean_cell(cells[1]) if len(cells) > 1 else ""
    caps_text = _clean_cell(cells[2]) if len(cells) > 2 else ""
    caps = [part.strip() for part in caps_text.split("|") if part.strip()] if caps_text else []
    auth_text = _clean_cell(cells[3]) if len(cells) > 3 else ""
    return {
        "k": row_id,
        "name": name,
        "url": url,
        "caps": caps,
        "auth": auth_text or None,
        "fam": None,
    }


def parse_supportedsites(
    text: str, known_families: Iterable[str] | None = None
) -> dict[str, Any]:
    known = set(known_families) if known_families is not None else None
    sites: list[dict[str, Any]] = []
    family_members: dict[str, list[str]] = {}
    current_family: str | None = None

    for row_id, body in _iter_id_rows(text):
        if _is_group_header(body):
            current_family = row_id
            family_members.setdefault(row_id, [])
            continue

        site = _parse_site_row(row_id, body)
        if current_family is not None:
            family_members[current_family].append(row_id)
            if known is None or current_family in known:
                site["fam"] = current_family
        sites.append(site)

    return {"sites": sites, "family_members": family_members}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        default=DEFAULT_SOURCE_URL,
        help="Path or HTTP(S) URL to supportedsites.md (default: pinned Codeberg tag)",
    )
    parser.add_argument("-o", "--output", help="Output JSON path; default: stdout")
    parser.add_argument("--compact", action="store_true", help="Write compact JSON")
    args = parser.parse_args(argv)

    text = load_text(args.source)
    result = parse_supportedsites(text)

    n_sites = len(result["sites"])
    n_families = len(result["family_members"])
    print(f"parsed {n_sites} sites in {n_families} groups from {args.source}", file=sys.stderr)

    kwargs: dict[str, Any] = {"ensure_ascii": False}
    if args.compact:
        kwargs["separators"] = (",", ":")
    else:
        kwargs["indent"] = 2

    encoded = json.dumps(result, **kwargs) + "\n"
    if args.output:
        Path(args.output).write_text(encoded, encoding="utf-8")
    else:
        sys.stdout.write(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
