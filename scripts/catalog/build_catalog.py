#!/usr/bin/env python3
"""Build the gdluxx gallery-dl options catalog artifact.

Converts the output of `gallery_dl_rst_to_json.py` into the UI-shaped JSON consumed
 by `src/routes/config/catalog`.

Usage:
    python3 scripts/catalog/build_catalog.py
    python3 scripts/catalog/build_catalog.py --rst /path/to/configuration.rst
    python3 scripts/catalog/build_catalog.py --rst <url> --sites <url> --out <path>

With no arguments, fetches the pinned Codeberg tags (`DEFAULT_SOURCE_URL`,
`DEFAULT_SITES_URL` below) and writes to
`src/lib/assets/gallery-dl-catalog.json`.

Regeneration on a gallery-dl version bump requires updating `GALLERY_DL_VERSION`
below , then run `pnpm catalog:build`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import gallery_dl_rst_to_json as rst_parser
import supportedsites as sites_parser

GALLERY_DL_VERSION = "1.32.9"
SOURCE_REF = f"v{GALLERY_DL_VERSION}"
DEFAULT_SOURCE_URL = (
    f"https://codeberg.org/mikf/gallery-dl/raw/tag/{SOURCE_REF}/docs/configuration.rst"
)
DEFAULT_SITES_URL = (
    f"https://codeberg.org/mikf/gallery-dl/raw/tag/{SOURCE_REF}/docs/supportedsites.md"
)

GENERATOR_VERSION = 1

# Verbatim RST section heading
SECTION_LABELS: dict[str, str] = {
    "Extractor Options": "Extractor",
    "Extractor-specific Options": "Site-specific",
    "Downloader Options": "Downloader",
    "Output Options": "Output",
    "Postprocessor Options": "Post-processing",
    "Miscellaneous Options": "Misc",
    "API Tokens & IDs": "API Tokens",
}

_URL_RE = re.compile(r"^https?://")


def fetch_bytes(source: str) -> bytes:
    """Read `source` (path or http(s) URL) and return its raw bytes."""
    if _URL_RE.match(source):
        req = urllib.request.Request(
            source, headers={"User-Agent": "gdluxx-catalog-build/1"}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()
    return Path(source).read_bytes()


def derive_site_fam(name: str) -> tuple[str | None, str | None]:
    """Site/family for an option name"""
    parts = name.split(".")
    if len(parts) < 3 or parts[0] != "extractor":
        return None, None
    seg2 = parts[1]
    if seg2 == "*":
        return None, None
    if seg2.startswith("[") and seg2.endswith("]"):
        return None, seg2[1:-1]
    return seg2, None


def build_type_refs(entry: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"k": t["kind"], "x": t["text"]} for t in entry.get("types", [])]


def build_default(entry: dict[str, Any]) -> dict[str, Any] | None:
    default = entry.get("default")
    if default is None:
        return None
    if default.get("parsed"):
        result: dict[str, Any] = {"p": True, "v": default["value"]}
    else:
        result = {"p": False, "x": default["text"]}
    matrix = default.get("matrix")
    if matrix:
        result["m"] = [
            {"v": row["value"], "pv": row["value_parsed"], "sites": row["sites"]}
            for row in matrix
        ]
    return result


def build_vals(entry: dict[str, Any]) -> dict[str, list[dict[str, str]]] | None:
    value_sets: dict[str, list[str]] = entry.get("value_sets") or {}
    if not value_sets:
        return None
    value_sets_detail: dict[str, list[dict[str, str]]] = entry.get("value_sets_detail") or {}
    vals: dict[str, list[dict[str, str]]] = {}
    for label, values in value_sets.items():
        detail = value_sets_detail.get(label)
        if detail:
            vals[label] = [{"t": row["value"], "d": row["description"]} for row in detail]
        else:
            vals[label] = [{"t": value, "d": ""} for value in values]
    return vals


def build_examples(entry: dict[str, Any]) -> list[str] | None:
    examples = entry.get("examples") or []
    values = [ex.get("code") or ex.get("text") for ex in examples]
    codes = [value for value in values if value]
    return codes or None


def build_terms(terms: list[dict[str, str]] | None) -> list[dict[str, str]] | None:
    if not terms:
        return None
    return [{"t": t["term"], "d": t["definition"]} for t in terms]


def build_option(entry: dict[str, Any]) -> dict[str, Any]:
    o: dict[str, Any] = {
        "n": entry["name"],
        "s": entry["section"],
        "ln": entry["source_line"],
        "d": entry.get("description", ""),
    }

    dterms = build_terms(entry.get("description_terms"))
    if dterms:
        o["dterms"] = dterms

    o["t"] = build_type_refs(entry)

    default = build_default(entry)
    if default is not None:
        o["def"] = default

    vals = build_vals(entry)
    if vals:
        o["vals"] = vals

    ex = build_examples(entry)
    if ex:
        o["ex"] = ex

    note = entry.get("note")
    if note:
        o["note"] = note

    nterms = build_terms(entry.get("note_terms"))
    if nterms:
        o["nterms"] = nterms

    names = entry.get("names") or []
    if len(names) > 1:
        o["names"] = names

    site, fam = derive_site_fam(entry["name"])
    if site:
        o["site"] = site
    if fam:
        o["fam"] = fam

    return o


def build_sections(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for e in entries:
        if e["kind"] == "option":
            counts[e["section"]] = counts.get(e["section"], 0) + 1
    return [
        {"id": section_id, "label": label, "count": counts.get(section_id, 0)}
        for section_id, label in SECTION_LABELS.items()
    ]


def build_custom_types(entries: list[dict[str, Any]]) -> dict[str, str]:
    return {
        e["name"]: e.get("description", "")
        for e in entries
        if e["kind"] == "custom_type"
    }


def build_families(
        options: list[dict[str, Any]],
        family_members: dict[str, list[str]] | None = None,
) -> dict[str, dict[str, Any]]:
    """Families keyed by their `[Bracket]` name, as seen in option names."""
    family_members = family_members or {}
    families: dict[str, dict[str, Any]] = {}
    for o in options:
        fam = o.get("fam")
        if fam and fam not in families:
            families[fam] = {
                "label": fam,
                "members": list(family_members.get(fam, [])),
                "optionPrefix": f"extractor.[{fam}].",
            }
    return families


def build_provenance(
        entries: list[dict[str, Any]],
        options: list[dict[str, Any]],
        source_url: str,
        source_sha256: str,
        sites_sha256: str | None,
        site_count: int,
) -> dict[str, Any]:
    return {
        "galleryDlVersion": GALLERY_DL_VERSION,
        "sourceRef": SOURCE_REF,
        "sourceUrl": source_url,
        "sourceSha256": source_sha256,
        "sitesSha256": sites_sha256,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generatorVersion": GENERATOR_VERSION,
        "optionCount": len(options),
        "siteCount": site_count,
    }


def build_artifact(
        result: dict[str, Any],
        source_sha256: str,
        sites_text: str | None,
        sites_sha256: str | None,
) -> dict[str, Any]:
    entries = result["entries"]
    options = [build_option(e) for e in entries if e["kind"] == "option"]
    family_keys = {o["fam"] for o in options if o.get("fam")}

    if sites_text is not None:
        sites_result = sites_parser.parse_supportedsites(sites_text, known_families=family_keys)
        family_members = sites_result["family_members"]
        sites = sites_result["sites"]
    else:
        family_members = {}
        sites = []

    families = build_families(options, family_members)

    return {
        "format": "gdluxx-gallery-dl-catalog",
        "schemaVersion": 1,
        "provenance": build_provenance(
            entries, options, DEFAULT_SOURCE_URL, source_sha256, sites_sha256, len(sites)
        ),
        "sections": build_sections(entries),
        "options": options,
        "customTypes": build_custom_types(entries),
        "families": families,
        "sites": sites,
    }


def default_out_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "src" / "lib" / "assets" / "gallery-dl-catalog.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rst",
        default=DEFAULT_SOURCE_URL,
        help="Path or HTTP(S) URL to configuration.rst (default: pinned Codeberg tag)",
    )
    parser.add_argument(
        "--sites",
        default=DEFAULT_SITES_URL,
        help="Path or HTTP(S) URL to supportedsites.md (default: pinned Codeberg tag)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output artifact path (default: src/lib/assets/gallery-dl-catalog.json)",
    )
    args = parser.parse_args(argv)

    raw_bytes = fetch_bytes(args.rst)
    source_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    text = raw_bytes.decode("utf-8")

    result = rst_parser.parse_document(text)
    errors, warnings = rst_parser.validate(result)

    print(f"parsed {result['entry_count']} entries from {args.rst}", file=sys.stderr)
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    sites_raw_bytes = fetch_bytes(args.sites)
    sites_sha256 = hashlib.sha256(sites_raw_bytes).hexdigest()
    sites_text = sites_raw_bytes.decode("utf-8")

    artifact = build_artifact(result, source_sha256, sites_text, sites_sha256)

    out_path = Path(args.out) if args.out else default_out_path()
    encoded = json.dumps(artifact, ensure_ascii=False, separators=(",", ":")) + "\n"
    out_path.write_text(encoded, encoding="utf-8")

    n_options = len(artifact["options"])
    n_custom_types = len(artifact["customTypes"])
    n_families = len(artifact["families"])
    n_sites = len(artifact["sites"])
    print(
        f"wrote {out_path}: {n_options} options, {n_custom_types} custom types, "
        f"{n_families} families, {n_sites} sites, sha256={source_sha256}, "
        f"sites_sha256={sites_sha256}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
