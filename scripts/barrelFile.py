#!/usr/bin/env python3
"""
Generate barrel (index.ts) files for specified directories
"""

import os

VALID_EXTS = {'.svelte'}
BARREL_FILENAME = 'index.ts'


def generate_barrel(dir_path: str):
    entries = []

    for name in sorted(os.listdir(dir_path)):
        path = os.path.join(dir_path, name)
        base, ext = os.path.splitext(name)
        if os.path.isfile(path) and ext in VALID_EXTS and name != BARREL_FILENAME:
            entries.append(f"export {{ default as {base} }} from './{base}.svelte';")

    if not entries:
        print(f"[ERROR] No modules in {dir_path}")
        return

    barrel_path = os.path.join(dir_path, BARREL_FILENAME)
    with open(barrel_path, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated barrel file, manual edits will be lost\n')
        f.write('\n'.join(entries) + '\n')
    print(f"[SUCCESS] {barrel_path}")


def main(directories):
    for d in directories:
        if not os.path.isdir(d):
            print(f"[WARNING] '{d}' is not a valid directory, skipping.")
            continue
        generate_barrel(d)


if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    components_dir = 'src/lib/components'

    base_barrel_dirs = [
        'auth',
        'icons',
        'settings',
        'ui'
    ]

    barrel_dirs = [os.path.join(components_dir, d) for d in base_barrel_dirs]

    dirs = [os.path.join(base_dir, d) for d in barrel_dirs]

    dirs.append(os.path.join(base_dir, components_dir))

    main(dirs)
