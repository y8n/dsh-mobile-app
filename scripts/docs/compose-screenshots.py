"""Join unmodified emulator screenshots for README; requires Pillow."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[2]
folder = root / 'docs/screenshots'
manifest_path = folder / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
groups = {
    'native-pages-light.png': ['workspaces-light.png', 'conversation-light.png', 'device-settings-light.png'],
    'file-viewers-light.png': ['files-light.png', 'diff-light.png', 'file-types-light.png'],
}
for output, sources in groups.items():
    width, gap = 360, 16
    panels = []
    for source in sources:
        with Image.open(folder / source) as original:
            panels.append(original.convert('RGB').resize((width, round(original.height * width / original.width)), Image.Resampling.LANCZOS))
    canvas = Image.new('RGB', (sum(p.width for p in panels) + gap * (len(panels) - 1), max(p.height for p in panels)), 'white')
    x = 0
    for panel in panels:
        canvas.paste(panel, (x, 0))
        x += panel.width + gap
    target = folder / output
    canvas.save(target, optimize=True)
    entry = {'path': target.relative_to(root).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
             'composition': {'sources': ['docs/screenshots/' + s for s in sources], 'panelWidth': width, 'gap': gap, 'operations': 'resize proportionally and join horizontally; no UI content changes'}}
    manifest['images'] = [i for i in manifest['images'] if i['path'] != entry['path']] + [entry]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
