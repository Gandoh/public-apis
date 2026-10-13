#!/usr/bin/env python3
"""Build the JSON catalog used by the API Scout static site.

The source of truth stays in README.md. Run this script whenever the API table
changes so the browser experience stays in sync with the repository.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "README.md"
OUTPUT = ROOT / "site" / "data" / "apis.json"
IGNORED_HEADINGS = {"APIs Covered Under APILayer Suite!"}


def slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "api"


def clean_cell(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_auth(value: str) -> str:
    value = clean_cell(value).strip("`").strip()
    if value.lower() in {"no", "none"}:
        return "No"
    if value.lower() == "apikey":
        return "apiKey"
    return value


def normalize_bool(value: str) -> str:
    value = clean_cell(value).strip("`").strip()
    if value.lower() == "yes":
        return "Yes"
    if value.lower() == "no":
        return "No"
    return "Unknown"


def parse_link(cell: str) -> tuple[str, str] | None:
    # The URL can contain parentheses, so use a greedy match up to the final
    # closing parenthesis in the first table cell.
    match = re.match(r"\[([^\]]+)\]\((.*)\)$", cell.strip())
    if not match:
        return None
    return clean_cell(match.group(1)), match.group(2).strip()


def parse_catalog() -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    current_category: str | None = None

    for line_number, line in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), 1):
        heading = re.match(r"^### (.+)$", line)
        if heading:
            current_category = heading.group(1).strip()
            if current_category in IGNORED_HEADINGS:
                current_category = None
            continue

        if not current_category or not line.startswith("| ["):
            continue

        cells = [cell.strip() for cell in line.strip().split("|")[1:]]
        while cells and not cells[-1]:
            cells.pop()
        if len(cells) < 5:
            continue

        parsed_link = parse_link(cells[0])
        if not parsed_link:
            continue

        name, url = parsed_link
        description = clean_cell(cells[1])
        auth = normalize_auth(cells[2])
        https = normalize_bool(cells[3])
        cors = normalize_bool(cells[4])
        host = urlparse(url).netloc.lower().removeprefix("www.") or "external provider"

        entries.append(
            {
                "id": f"{slugify(name)}-{len(entries) + 1}",
                "name": name,
                "url": url,
                "host": host,
                "category": current_category,
                "description": description,
                "auth": auth,
                "https": https,
                "cors": cors,
                "sourceLine": str(line_number),
            }
        )

    return entries


def main() -> None:
    apis = parse_catalog()
    categories = Counter(api["category"] for api in apis)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "README.md",
        "generatedAt": date.today().isoformat(),
        "count": len(apis),
        "categories": [
            {"name": name, "count": count}
            for name, count in sorted(categories.items(), key=lambda item: (-item[1], item[0].lower()))
        ],
        "apis": apis,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(apis):,} APIs across {len(categories)} categories to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
