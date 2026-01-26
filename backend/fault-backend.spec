# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\project\\fault\\backend\\run_server.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\project\\fault\\backend\\main.py', '.'), ('C:\\project\\fault\\backend\\config.py', '.'), ('C:\\project\\fault\\backend\\api', 'api'), ('C:\\project\\fault\\backend\\data', 'data'), ('C:\\project\\fault\\backend\\ingd', 'ingd'), ('C:\\project\\fault\\backend\\weights', 'weights')],
    hiddenimports=['uvicorn.logging', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off', 'fastapi', 'pydantic', 'torch', 'numpy', 'pandas', 'networkx', 'scipy', 'sklearn', 'loguru'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='fault-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
