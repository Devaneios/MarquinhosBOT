from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
source = root / '.worktrees' / sys.argv[1]
baseline = json.loads((root / '.audit/achievement-maintenance-originals.json').read_text())
base = subprocess.check_output(['git', 'merge-base', 'HEAD', 'main'], cwd=source).decode().strip()
changed = subprocess.check_output(['git', 'diff', '--name-only', base], cwd=source).decode().splitlines()
added = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=source).decode().splitlines()
paths = sorted({p for p in changed + added if not p.startswith('.audit/') and 'node_modules' not in Path(p).parts})
for name in paths:
    target = root / name
    current = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    if current != baseline.get(name):
        raise SystemExit(f'Checkout changed after baseline capture: {name}')
for name in paths:
    target = root / name
    original = source / name
    if original.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
    elif target.is_file():
        target.unlink()
print(json.dumps({'worktree': str(source), 'integrated': paths}, indent=2))
