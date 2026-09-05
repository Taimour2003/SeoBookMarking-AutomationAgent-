# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules

# Jin libraries ke missing modules aate hain, unhe yahan list karein
packages_to_collect = ['playwright','groq']

datas = []
binaries = []
hiddenimports = []

for package in packages_to_collect:
    tmp_datas, tmp_binaries, tmp_hiddenimports = collect_all(package)
    datas.extend(tmp_datas)
    binaries.extend(tmp_binaries)
    hiddenimports.extend(tmp_hiddenimports)

hiddenimports.extend([
    'playwright.async_api',
    'groq',
])

a = Analysis(
    ['MainBrowserAgent/src/main.py'],
    pathex=['MainBrowserAgent/src'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='WebAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
)