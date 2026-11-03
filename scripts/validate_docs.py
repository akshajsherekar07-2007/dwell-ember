"""Dependency-free consistency checks, not full OpenAPI/SQL runtime validation."""
from pathlib import Path
import ast
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
issues = []


def require(condition, message):
    if not condition:
        issues.append(message)


def walk(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


required = ["README.md", "docs/PRD.md", "docs/SRS.md", "docs/DATABASE.md", "docs/API.md",
            "docs/UI_UX.md", "docs/ARCHITECTURE.md", "docs/IMPLEMENTATION_PLAN.md",
            "docs/OPERATIONS.md", "docs/DECISIONS.md", "docs/VALIDATION.md",
            "database/schema.sql", "api/openapi.json"]
for name in required:
    require((ROOT / name).is_file(), f"Missing deliverable: {name}")

for file in [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]:
    content = file.read_text(encoding="utf-8")
    require("Dwell Ember" in content, f"Brand missing: {file.name}")
    require(content.count("```") % 2 == 0, f"Unbalanced code fence: {file.name}")
    for label, target in re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content):
        if target.startswith(("http:", "https:", "#", "mailto:")):
            continue
        path = target.split("#", 1)[0]
        require((file.parent / path).is_file(), f"Broken local link in {file.name}: {target}")

spec = json.loads((ROOT / "api/openapi.json").read_text(encoding="utf-8"))
require(spec.get("openapi") == "3.1.0", "Expected OpenAPI 3.1.0")
for node in walk(spec):
    pointer = node.get("$ref")
    if not pointer:
        continue
    require(pointer.startswith("#/"), f"Unexpected external reference: {pointer}")
    value = spec
    try:
        for segment in pointer[2:].split("/"):
            value = value[segment.replace("~1", "/").replace("~0", "~")]
    except (KeyError, TypeError):
        issues.append(f"Unresolved reference: {pointer}")

identifiers = set()
known_requirements = set(re.findall(r"\b(?:FR|NFR)-\d{2}\b", (ROOT / "docs/SRS.md").read_text(encoding="utf-8")))
operations = 0
for path, methods in spec["paths"].items():
    for method, op in methods.items():
        operations += 1
        ident = op.get("operationId")
        require(bool(ident) and ident not in identifiers, f"Missing/duplicate operationId: {ident}")
        identifiers.add(ident)
        expected = set(re.findall(r"\{([^}]+)\}", path))
        actual = {p["name"] for p in op.get("parameters", []) if p.get("in") == "path"}
        require(expected == actual, f"Path parameters do not match: {path}")
        require(bool(op.get("x-requirements")), f"No requirement references: {ident}")
        for req in op.get("x-requirements", []):
            require(req in known_requirements, f"Unknown requirement {req}: {ident}")
        require(any(str(k).startswith("2") for k in op["responses"]), f"No success response: {ident}")
        if method not in ("get", "head") and path != "/webhooks/razorpay":
            require(any(p.get("name") == "Idempotency-Key" and p.get("required") for p in op.get("parameters", [])),
                    f"Mutation lacks idempotency header: {ident}")

sql = (ROOT / "database/schema.sql").read_text(encoding="utf-8")
tables = re.findall(r"CREATE TABLE public\.(\w+)", sql)
require(len(tables) == len(set(tables)), "Duplicate SQL table definitions")
for table in tables:
    require(f"'{table}'" in sql, f"Table not listed in RLS bootstrap: {table}")
for index in ("allocations_one_active_per_bed", "allocations_one_pending_per_student",
              "waitlist_one_live_student_bed", "credit_purchase_once"):
    require(index in sql, f"Missing critical unique index: {index}")
for file in (ROOT / "scripts").glob("*.py"):
    ast.parse(file.read_text(encoding="utf-8"), filename=str(file))

if issues:
    print("FAILED")
    print("\n".join(f"- {message}" for message in issues))
    sys.exit(1)
print(f"PASS: {len(required)} deliverables, local links/fences, {operations} API operations, references/requirements, {len(tables)} RLS-listed tables, Python syntax")
