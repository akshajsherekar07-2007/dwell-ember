"""Package only the reviewable foundation; exclude dependencies and secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "Dwell-Ember-Foundation.zip"
files = [ROOT / name for name in ("README.md", ".gitignore", ".env.example")]
for directory in ("docs", "database", "api", "scripts", "assets/ui-concepts"):
    files.extend(file for file in (ROOT / directory).rglob("*")
                 if file.is_file() and "__pycache__" not in file.parts
                 and file.suffix in (".md", ".sql", ".json", ".py", ".cjs", ".png"))
with ZipFile(DESTINATION, "w", ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, Path("Dwell-Ember") / file.relative_to(ROOT))
with ZipFile(DESTINATION) as archive:
    assert archive.testzip() is None, "Archive integrity failure"
    assert all("node_modules" not in name and not name.endswith("/.env") for name in archive.namelist())
print(f"Packaged {len(files)} files: {DESTINATION.name} ({DESTINATION.stat().st_size:,} bytes); archive integrity passed")
