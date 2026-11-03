"""Package app source and assets without credentials, dependencies or demo records."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root=Path(__file__).resolve().parents[1]
names=["README.md",".env.example",".gitignore","AGENTS.md","package.json","package-lock.json",
       "tsconfig.json","next-env.d.ts","next.config.ts","vitest.config.ts"]
files=[root/name for name in names if (root/name).is_file()]
for directory in ["src","public","tests","docs","database","api","scripts","assets"]:
    files.extend(p for p in (root/directory).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
destination=root/"Dwell-Ember-App.zip"
with ZipFile(destination,"w",ZIP_DEFLATED) as archive:
    for p in sorted(files):archive.write(p,Path("Dwell-Ember")/p.relative_to(root))
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert not any("/.data/" in n or "/node_modules/" in n or n.endswith("/.env") for n in archive.namelist())
print(f"Packaged {len(files)} files: {destination.name}; integrity passed")
