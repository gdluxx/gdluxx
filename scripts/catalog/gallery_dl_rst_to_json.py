#!/usr/bin/env python3
"""Convert gallery-dl's docs/configuration.rst into machine-readable JSON."""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
import textwrap
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


UNDERLINE_CHARS = {"#", "=", "-", "~", "^", '"', "`", ":", "+", "*", "_"}
KNOWN_TOP_SECTIONS = {
    "Extractor Options",
    "Extractor-specific Options",
    "Downloader Options",
    "Output Options",
    "Postprocessor Options",
    "Miscellaneous Options",
    "API Tokens & IDs",
    "Custom Types",
}

_INLINE_LITERAL_RE = re.compile(r"``([^`]+)``")
_BULLET_RE = re.compile(r"^[*+-]\s+")


@dataclass(frozen=True)
class Heading:
    line: int
    title: str
    marker: str


def is_underline(text: str, title: str | None = None) -> bool:
    s = text.strip()
    if not s or s[0] not in UNDERLINE_CHARS or len(set(s)) != 1:
        return False
    return title is None or len(s) >= len(title.strip())


def headings(lines: list[str]) -> list[Heading]:
    out: list[Heading] = []
    for i in range(len(lines) - 1):
        title = lines[i]
        underline = lines[i + 1]
        # Only document-level headings. Code examples are indented.
        if title != title.lstrip() or underline != underline.lstrip():
            continue
        if title.strip() and is_underline(underline, title):
            out.append(Heading(i, title.strip(), underline.strip()[0]))
    return out


def load_text(source: str) -> str:
    if re.match(r"^https?://", source):
        req = urllib.request.Request(source, headers={"User-Agent": "gallery-dl-rst-to-json/1"})
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read().decode("utf-8")
    return Path(source).read_text(encoding="utf-8")


def strip_inline_rst(text: str) -> str:
    """Best effort conversion of common inline RST constructs to plain text"""
    s = text
    # substitution references used for custom types: |Path|_ -> Path
    s = re.sub(r"\|([^|]+)\|_?", r"\1", s)
    # inline literals: ``string`` -> string
    s = re.sub(r"``([^`]+)``", r"\1", s)
    s = re.sub(r"´´([^´]+)´´", r"\1", s)
    # explicit links: `label <target>`__ -> label
    s = re.sub(r"`([^`<]+?)\s*<[^>]+>`__?", r"\1", s)
    # simple references: `Format String`_ / Condition_ -> Format String / Condition
    s = re.sub(r"`([^`]+)`_", r"\1", s)
    s = re.sub(r"\b([A-Za-z][A-Za-z0-9 +./-]*)_\b", r"\1", s)
    # emphasis
    s = re.sub(r"\*([^*]+)\*", r"\1", s)
    return s.strip()


def dedent_field(lines: list[str]) -> str:
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        return ""
    return textwrap.dedent("\n".join(lines)).rstrip()


def strip_line_block(lines: list[str]) -> list[str]:
    """Blank out RST line-block markers ('| ' / bare '|')."""
    out: list[str] = []
    for line in lines:
        stripped = line.lstrip()
        indent = line[: len(line) - len(stripped)]
        bullet = _BULLET_RE.match(stripped)
        head = bullet.group(0) if bullet else ""
        rest = stripped[len(head):]
        if rest == "|":
            out.append(indent + head + " ")
        elif rest.startswith("| "):
            out.append(indent + head + "  " + rest[2:])
        else:
            out.append(line)
    return out


def split_fields(body_lines: list[str]) -> tuple[dict[str, str], str]:
    """Split an option body into RST definition list fields plus unclassified preface."""
    fields: dict[str, str] = {}
    preface: list[str] = []
    i = 0

    while i < len(body_lines):
        line = body_lines[i]
        if line and line == line.lstrip() and not line.startswith(".. ") and not line.startswith("|"):
            k = i + 1
            while k < len(body_lines) and not body_lines[k].strip():
                k += 1
            if k < len(body_lines) and body_lines[k] != body_lines[k].lstrip():
                label = line.strip().rstrip(":")
                j = i + 1
                chunk: list[str] = []
                while j < len(body_lines):
                    candidate = body_lines[j]
                    if candidate and candidate == candidate.lstrip() and not candidate.startswith(".. ") and not candidate.startswith("|"):
                        n = j + 1
                        while n < len(body_lines) and not body_lines[n].strip():
                            n += 1
                        if n < len(body_lines) and body_lines[n] != body_lines[n].lstrip():
                            break
                    chunk.append(candidate)
                    j += 1
                value = dedent_field(chunk)
                if label in fields:
                    fields[label] += "\n\n" + value
                else:
                    fields[label] = value
                i = j
                continue
        preface.append(line)
        i += 1

    return fields, "\n".join(preface).strip()


def split_nested_deflist(raw: str) -> tuple[str, list[dict[str, str]]]:
    """Factored out of split_fields' term/body scan, applied one level deeper.
    """
    lines = raw.splitlines()
    n_lines = len(lines)
    preface: list[str] = []
    terms: list[dict[str, str]] = []
    i = 0

    def has_indented_follow(k: int) -> bool:
        while k < n_lines and not lines[k].strip():
            k += 1
        return k < n_lines and lines[k] != lines[k].lstrip()

    while i < n_lines:
        line = lines[i]
        if (
            line
            and line == line.lstrip()
            and not line.startswith(".. ")
            and not _BULLET_RE.match(line)
            and has_indented_follow(i + 1)
        ):
            term_text = line.strip().rstrip(":")
            j = i + 1
            chunk: list[str] = []
            while j < n_lines:
                candidate = lines[j]
                if (
                    candidate
                    and candidate == candidate.lstrip()
                    and not candidate.startswith(".. ")
                    and not _BULLET_RE.match(candidate)
                    and has_indented_follow(j + 1)
                ):
                    break
                chunk.append(candidate)
                j += 1
            definition = dedent_field(chunk)
            terms.append({"term": term_text, "definition": definition})
            i = j
            continue
        preface.append(line)
        i += 1

    return "\n".join(preface).strip(), terms


def _flatten_description(text: str) -> str:
    """Join description like lines into one sentence while skipping code blocks
    and directive lines."""
    out: list[str] = []
    skip_code = False
    for line in text.splitlines():
        if re.match(r"^\s*\.\.\s+code::", line):
            skip_code = True
            continue
        if skip_code:
            if not line.strip() or line.startswith(" "):
                continue
            skip_code = False
        s = line.strip()
        if not s or s.startswith(".. "):
            continue
        out.append(strip_inline_rst(s))
    return " ".join(out)


def structured_field(raw: str) -> dict[str, Any]:
    """{"text": <preface, flattened>, "terms": [...]}; "terms" omitted if empty."""
    if not raw:
        return {"text": ""}
    lines = strip_line_block(raw.splitlines())
    preface, terms = split_nested_deflist("\n".join(lines))
    result: dict[str, Any] = {"text": _flatten_description(preface)}
    if terms:
        result["terms"] = [
            {"term": strip_inline_rst(t["term"]), "definition": _flatten_description(t["definition"])}
            for t in terms
        ]
    return result


def plain_description(raw: str) -> str:
    """Flattened description text. Line-blocks stripped, stops at the first
    nested definition list term."""
    if not raw:
        return ""
    return structured_field(raw)["text"]


def _extract_literal(text: str) -> str | None:
    """If `text`, once stripped, is exactly one double-backtick literal,
    return its inner content verbatim including any quote characters.
    Otherwise None."""
    m = _INLINE_LITERAL_RE.fullmatch(text.strip())
    return m.group(1) if m else None


def field_lookup(fields: dict[str, str]) -> dict[str, str]:
    """Map lowercased field label -> first-seen original key, for case-insensitive lookups."""
    lookup: dict[str, str] = {}
    for key in fields:
        low = key.lower()
        if low not in lookup:
            lookup[low] = key
    return lookup


def rst_bullet_items(raw: str) -> list[str]:
    items: list[str] = []
    for line in raw.splitlines():
        s = line.strip()
        if re.match(r"^[*+-]\s+", s):
            items.append(re.sub(r"^[*+-]\s+", "", s).strip())
    if not items and raw.strip():
        items = [raw.strip()]
    return items


def parse_scalar(raw: str) -> tuple[bool, Any]:
    """Parse a simple documented literal"""
    s = strip_inline_rst(raw.strip())
    if not s or "\n" in s:
        return False, None

    try:
        return True, json.loads(s)
    except Exception:
        pass

    try:
        value = ast.literal_eval(s)
        if isinstance(value, (str, int, float, bool, list, dict, tuple, type(None))):
            if isinstance(value, tuple):
                value = list(value)
            return True, value
    except Exception:
        pass

    # Plain numeric values
    if re.fullmatch(r"[-+]?\d+", s):
        return True, int(s)
    if re.fullmatch(r"[-+]?(?:\d+\.\d*|\d*\.\d+)(?:[eE][-+]?\d+)?", s):
        return True, float(s)

    return False, None


def code_blocks(raw: str) -> list[dict[str, Any]]:
    """Extract RST '.. code:: LANG' blocks from a field."""
    lines = raw.splitlines()
    blocks: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        m = re.match(r"^\s*\.\.\s+code::\s*([\w+-]*)\s*$", lines[i])
        if not m:
            i += 1
            continue
        lang = m.group(1) or None
        i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        chunk: list[str] = []
        while i < len(lines):
            if lines[i].strip() and lines[i] == lines[i].lstrip():
                break
            chunk.append(lines[i])
            i += 1
        code = textwrap.dedent("\n".join(chunk)).strip()
        value: Any = None
        parsed = False
        if lang == "json" and code:
            try:
                value = json.loads(code)
                parsed = True
            except json.JSONDecodeError:
                pass
        blocks.append({"language": lang, "code": code, "parsed": parsed, "value": value})
    return blocks



def parse_examples(raw: str) -> list[dict[str, Any]]:
    blocks = code_blocks(raw)
    if blocks:
        return blocks

    examples: list[dict[str, Any]] = []
    for item in rst_bullet_items(raw):
        text = strip_inline_rst(item)
        ok, value = parse_scalar(text)
        examples.append({
            "parsed": ok,
            "value": value if ok else None,
            "text": text,
        })
    return examples

def normalized_types(raw: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in rst_bullet_items(raw):
        plain = strip_inline_rst(item)
        low = plain.lower().strip()
        kind = "custom"
        if re.search(r"\bobject\b|→|->", plain):
            kind = "object"
        elif re.search(r"\blist\b|\barray\b", low):
            kind = "array"
        elif low in {"bool", "boolean"}:
            kind = "boolean"
        elif low in {"integer", "int"}:
            kind = "integer"
        elif low in {"float", "number"}:
            kind = "number"
        elif low in {"string", "str"}:
            kind = "string"
        elif low == "any":
            kind = "any"
        result.append({"kind": kind, "text": plain, "raw": item})
    return result


def parse_supported_values(raw: str) -> list[str]:
    values: list[str] = []
    for value in re.findall(r"``([^`]+)``", raw):
        if value not in values:
            values.append(value)
    if values:
        return values

    for item in rst_bullet_items(raw):
        plain = strip_inline_rst(item)
        if plain and plain not in values:
            values.append(plain)
    return values


def parse_value_set(raw: str) -> list[dict[str, str]]:
    """Structured sibling of parse_supported_values: [{"value","description"}]."""
    if not raw:
        return []
    lines = strip_line_block(raw.splitlines())
    joined = "\n".join(lines)
    _preface, terms = split_nested_deflist(joined)
    if terms:
        result: list[dict[str, str]] = []
        for t in terms:
            literal = _extract_literal(t["term"])
            value = literal if literal is not None else strip_inline_rst(t["term"])
            result.append({"value": value, "description": _flatten_description(t["definition"])})
        return result

    return [{"value": value, "description": ""} for value in parse_supported_values(joined)]


def parse_default_matrix(raw: str) -> list[dict[str, Any]] | None:
    """Additive pass when every definition is a pipe-separated run of
    ``literals``: [{"value","parsed","value_parsed","sites"}]
    """
    if not raw:
        return None
    lines = strip_line_block(raw.splitlines())
    _preface, terms = split_nested_deflist("\n".join(lines))
    if not terms:
        return None

    rows: list[dict[str, Any]] = []
    for t in terms:
        definition = t["definition"]
        tokens = _INLINE_LITERAL_RE.findall(definition)
        leftover = _INLINE_LITERAL_RE.sub("", definition).replace("|", "").strip()
        if leftover and tokens:
            return None
        sites = tokens if not leftover else []

        literal = _extract_literal(t["term"])
        value = literal if literal is not None else strip_inline_rst(t["term"])
        ok, value_parsed = parse_scalar(value)
        rows.append({
            "value": value,
            "parsed": ok,
            "value_parsed": value_parsed if ok else None,
            "sites": sites,
        })

    if not any(row["sites"] for row in rows):
        return None
    return rows


def expand_combined_names(title: str) -> list[str]:
    """Expand 'extractor.*.username & .password' into two full option names."""
    parts = [p.strip() for p in title.split(" & ")]
    if len(parts) == 1:
        return [title]
    first = parts[0]
    if "." not in first:
        return parts
    prefix = first.rsplit(".", 1)[0]
    names = [first]
    for part in parts[1:]:
        if part.startswith("."):
            names.append(prefix + part)
        else:
            names.append(part)
    return names


def normalize_entry(
    title: str,
    section: str,
    fields: dict[str, str],
    preface: str,
    line: int,
    stacked_with: list[str] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "name": title,
        "names": expand_combined_names(title),
        "section": section,
        "kind": "custom_type" if section == "Custom Types" else "option",
        "source_line": line + 1,
    }

    if stacked_with:
        entry["stacked_with"] = stacked_with
        for carried_title in stacked_with:
            entry["names"].extend(expand_combined_names(carried_title))
        entry["names"] = list(dict.fromkeys(entry["names"]))

    if preface:
        entry["preface_raw"] = preface

    lookup = field_lookup(fields)

    def get_field(label: str) -> str | None:
        key = lookup.get(label.lower())
        return fields[key] if key is not None else None

    type_field = get_field("Type")
    if type_field is not None:
        entry["types"] = normalized_types(type_field)

    default_field = get_field("Default")
    if default_field is not None:
        ok, value = parse_scalar(default_field)
        default_entry: dict[str, Any] = {
            "parsed": ok,
            "value": value if ok else None,
            "text": strip_inline_rst(default_field),
        }
        matrix = parse_default_matrix(default_field)
        if matrix:
            default_entry["matrix"] = matrix
        entry["default"] = default_entry

    example_field = get_field("Example")
    if example_field is not None:
        entry["examples"] = parse_examples(example_field)

    description_field = get_field("Description")
    if description_field is not None:
        described = structured_field(description_field)
        entry["description"] = described["text"]
        if "terms" in described:
            entry["description_terms"] = described["terms"]

    note_field = get_field("Note")
    if note_field is not None:
        noted = structured_field(note_field)
        entry["note"] = noted["text"]
        if "terms" in noted:
            entry["note_terms"] = noted["terms"]

    for label in (
        "Supported Values", "Valid Values", "Available Types", "Available Formats",
        "Possible Formats", "Available Events", "Supported Types", "Supported Fields",
        "Special Values", "Formats",
    ):
        value_field = get_field(label)
        if value_field is not None:
            entry.setdefault("value_sets", {})[label] = parse_supported_values(value_field)
            detail = parse_value_set(value_field)
            if detail and any(row["description"] for row in detail):
                entry.setdefault("value_sets_detail", {})[label] = detail

    entry["fields_raw"] = fields
    return entry


def parse_document(text: str) -> dict[str, Any]:
    lines = text.splitlines()
    hs = headings(lines)

    # Determine section at each line. Every '=' heading starts a new section
    section_at_line: dict[int, str] = {}
    current_section = ""
    for h in hs:
        if h.marker == "=":
            current_section = h.title
        section_at_line[h.line] = current_section

    # Entry headings are all '-' headings inside a real section (none exist currently,
    # but may in the future)
    entry_headings = [
        h for h in hs
        if h.marker == "-" and section_at_line.get(h.line, "") not in ("", "Contents")
    ]
    entries: list[dict[str, Any]] = []

    # Boundary is the next document level heading of either '-' or '='.
    all_boundary_lines = sorted(h.line for h in hs if h.marker in {"-", "="})
    boundary_pos = {line: idx for idx, line in enumerate(all_boundary_lines)}

    carried_titles: list[str] = []

    for i, h in enumerate(entry_headings):
        pos = boundary_pos[h.line]
        end = all_boundary_lines[pos + 1] if pos + 1 < len(all_boundary_lines) else len(lines)
        body = lines[h.line + 2 : end]
        fields, preface = split_fields(body)
        section = section_at_line[h.line]

        next_heading = entry_headings[i + 1] if i + 1 < len(entry_headings) else None
        stacked_next = (
            next_heading is not None
            and next_heading.line == end
            and section_at_line.get(next_heading.line) == section
        )
        if not fields and not preface and stacked_next:
            carried_titles.append(h.title)
            continue

        stacked_with = carried_titles or None
        carried_titles = []
        entries.append(normalize_entry(h.title, section, fields, preface, h.line, stacked_with))

    by_name: dict[str, list[int]] = {}
    for idx, entry in enumerate(entries):
        for name in entry["names"]:
            idxs = by_name.setdefault(name, [])
            if idx not in idxs:
                idxs.append(idx)

    return {
        "format": "gallery-dl-configuration-docs",
        "schema_version": 1,
        "entry_count": len(entries),
        "sections": sorted({e["section"] for e in entries}),
        "entries": entries,
        "index": by_name,
    }


KNOWN_FIELD_LABELS = {
    "type", "default", "example", "description", "note", "how to",
    "supported values", "valid values", "available types", "available formats",
    "possible formats", "available events", "supported types", "supported fields",
    "special values", "formats",
}


def _format_names(names: Iterable[str], limit: int = 10) -> str:
    names = list(names)
    shown = ", ".join(names[:limit])
    remaining = len(names) - limit
    if remaining > 0:
        shown += f", … and {remaining} more"
    return shown


def validate(result: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    entries = result["entries"]

    if not entries:
        errors.append("No entries were parsed.")
        return errors, warnings

    unknown_sections = sorted(set(result["sections"]) - KNOWN_TOP_SECTIONS - {"Contents"})
    if unknown_sections:
        errors.append(f"{len(unknown_sections)} unknown section(s): {_format_names(unknown_sections, limit=len(unknown_sections))}")

    empty_entries = sorted(
        e["name"] for e in entries
        if e["kind"] == "option" and not e["fields_raw"] and not e.get("preface_raw")
    )
    if empty_entries:
        errors.append(
            f"{len(empty_entries)} option entries have no fields and no preface: "
            f"{_format_names(empty_entries, limit=len(empty_entries))}"
        )

    duplicate_names = sorted(name for name, idxs in result["index"].items() if len(idxs) > 1)
    if duplicate_names:
        errors.append(
            f"{len(duplicate_names)} name(s) map to more than one entry: "
            f"{_format_names(duplicate_names, limit=len(duplicate_names))}"
        )

    missing_type = sorted(e["name"] for e in entries if e["kind"] == "option" and "types" not in e)
    if missing_type:
        warnings.append(
            f"{len(missing_type)} option entries have no Type field (may be intentional): "
            f"{_format_names(missing_type)}"
        )

    missing_description = sorted(e["name"] for e in entries if "description" not in e)
    if missing_description:
        warnings.append(
            f"{len(missing_description)} entries have no Description field "
            f"(custom types may use free-form content): {_format_names(missing_description)}"
        )

    unparsed_defaults = sorted(
        e["name"] for e in entries
        if e["kind"] == "option"
        and "default" in e
        and not e["default"]["parsed"]
        and "matrix" not in e["default"]
    )
    if unparsed_defaults:
        warnings.append(
            f"{len(unparsed_defaults)} option entries have a Default that failed scalar "
            f"parsing (manual-review queue): {_format_names(unparsed_defaults)}"
        )

    unknown_labels = sorted(
        f"{label!r} on {e['name']}"
        for e in entries
        for label in e["fields_raw"]
        if label.lower() not in KNOWN_FIELD_LABELS
    )
    if unknown_labels:
        warnings.append(f"{len(unknown_labels)} unknown field label(s): {_format_names(unknown_labels)}")

    def _leaked_pipe_texts(e: dict[str, Any]) -> bool:
        if " | " in e.get("description", "") or " | " in e.get("note", ""):
            return True
        for term in e.get("description_terms", []) or []:
            if " | " in term.get("definition", ""):
                return True
        for term in e.get("note_terms", []) or []:
            if " | " in term.get("definition", ""):
                return True
        for rows in (e.get("value_sets_detail") or {}).values():
            for row in rows:
                if " | " in row.get("description", ""):
                    return True
        return False

    leaked_pipes = sorted(e["name"] for e in entries if _leaked_pipe_texts(e))
    if leaked_pipes:
        warnings.append(
            f"{len(leaked_pipes)} entries have a flattened description/note (or nested "
            f"term/value text) that still contains ' | ' -- likely an unstripped "
            f"line-block leak: {_format_names(leaked_pipes)}"
        )

    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Path or HTTP(S) URL to configuration.rst")
    parser.add_argument("-o", "--output", help="Output JSON path; default: stdout")
    parser.add_argument("--compact", action="store_true", help="Write compact JSON")
    parser.add_argument("--check", action="store_true", help="Print parser errors/warnings to stderr")
    args = parser.parse_args(argv)

    text = load_text(args.source)
    result = parse_document(text)

    exit_code = 0
    if args.check:
        print(f"parsed {result['entry_count']} entries", file=sys.stderr)
        errors, warnings = validate(result)
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
        if errors:
            exit_code = 1

    kwargs = {"ensure_ascii": False}
    if args.compact:
        kwargs["separators"] = (",", ":")
    else:
        kwargs["indent"] = 2

    encoded = json.dumps(result, **kwargs) + "\n"
    if args.output:
        Path(args.output).write_text(encoded, encoding="utf-8")
    else:
        sys.stdout.write(encoded)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
