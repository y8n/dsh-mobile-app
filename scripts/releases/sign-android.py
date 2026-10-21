#!/usr/bin/env python3
"""Sign an unsigned release APK with the pinned certificate lineage. Never print secrets."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]

def checked(args, *, env=None):
    result = subprocess.run([str(a) for a in args], env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{Path(str(args[0])).name} failed (exit {result.returncode}); signing aborted')
    return result.stdout

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise RuntimeError('Output already exists; refusing to replace an artifact')
    env = os.environ.copy()
    required = ['DSH_ANDROID_RELEASE_KEYSTORE', 'DSH_ANDROID_RELEASE_PASSWORD', 'DSH_ANDROID_LEGACY_KEYSTORE', 'DSH_ANDROID_LEGACY_PASSWORD', 'ANDROID_HOME']
    for key in required:
        if not env.get(key):
            raise RuntimeError(f'Missing signing input: {key}')
    tools = Path(env['ANDROID_HOME']) / 'build-tools/35.0.0'
    policy = json.loads((ROOT / 'config/android-signing/certificates.json').read_text())
    lineage = ROOT / 'config/android-signing/lineage.bin'
    assert hashlib.sha256(lineage.read_bytes()).hexdigest() == policy['lineageSha256'], 'Lineage mismatch'
    for role, alias in [('RELEASE', 'dsh-release'), ('LEGACY', 'legacy')]:
        cert = subprocess.run(['keytool', '-exportcert', '-keystore', env[f'DSH_ANDROID_{role}_KEYSTORE'], '-alias', alias,
                               '-storepass:env', f'DSH_ANDROID_{role}_PASSWORD'], env=env, capture_output=True)
        assert cert.returncode == 0, f'{role} key could not be read'
        assert hashlib.sha256(cert.stdout).hexdigest() == policy[role.lower() + 'Sha256'], f'{role} certificate mismatch'
    badging = checked([tools / 'aapt', 'dump', 'badging', args.input])
    assert "package: name='dev.dsh.mobile'" in badging
    assert 'application-debuggable' not in badging, 'Refuse to sign debuggable APK'
    version = re.search(r"versionCode='(\d+)' versionName='([^']+)'", badging)
    assert version
    with zipfile.ZipFile(args.input) as apk:
        for name in ['assets/licenses/LICENSE', 'assets/licenses/NOTICE', 'assets/licenses/THIRD_PARTY_NOTICES.md']:
            assert len(apk.read(name)) > 100, 'Missing license material'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='dsh-sign-') as work:
        aligned = Path(work) / 'aligned.apk'
        signed = Path(work) / 'signed.apk'
        checked([tools / 'zipalign', '-P', '16', '-f', '4', args.input, aligned])
        checked([tools / 'apksigner', 'sign', '--ks', env['DSH_ANDROID_LEGACY_KEYSTORE'], '--ks-key-alias', 'legacy',
                 '--ks-pass', 'env:DSH_ANDROID_LEGACY_PASSWORD', '--key-pass', 'env:DSH_ANDROID_LEGACY_PASSWORD',
                 '--next-signer', '--ks', env['DSH_ANDROID_RELEASE_KEYSTORE'], '--ks-key-alias', 'dsh-release',
                 '--ks-pass', 'env:DSH_ANDROID_RELEASE_PASSWORD', '--key-pass', 'env:DSH_ANDROID_RELEASE_PASSWORD',
                 '--lineage', lineage, '--rotation-min-sdk-version', str(policy['rotationMinSdk']),
                 '--min-sdk-version', '26', '--v4-signing-enabled', 'false', '--debuggable-apk-permitted', 'false',
                 '--out', signed, aligned], env=env)
        reports = {}
        for minimum, maximum, role in [(26, 27, 'legacy'), (28, 32, 'release'), (33, 36, 'release')]:
            result = checked([tools / 'apksigner', 'verify', '--verbose', '--print-certs', '--min-sdk-version', str(minimum), '--max-sdk-version', str(maximum), signed])
            assert f"Signer #1 certificate SHA-256 digest: {policy[role + 'Sha256']}" in result, f'Wrong signer for API {minimum}'
            reports[f'{minimum}-{maximum}'] = role
        checked([tools / 'zipalign', '-c', '-P', '16', '4', signed])
        with args.output.open('xb') as output:
            output.write(signed.read_bytes())
    report = {'versionName': version[2], 'versionCode': int(version[1]), 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
              'bytes': args.output.stat().st_size, 'debuggable': False, 'signersByApi': reports, 'certificates': policy,
              'sourceCommit': checked(['git', '-C', ROOT, 'rev-parse', 'HEAD']).strip()}
    args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
