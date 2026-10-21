#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Audit resolved Maven artifacts/POMs without building an APK.
Run collectLicenseCoordinates first. Original embedded notices are copied verbatim.
"""
import pathlib,json,xml.etree.ElementTree as ET,hashlib,zipfile,io,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
CACHE=pathlib.Path.home()/'.gradle/caches/modules-2/files-2.1'
OUT=ROOT/'legal/dependencies/android-texts';OUT.mkdir(parents=True,exist_ok=True)

def save(data):
    sha=hashlib.sha256(data).hexdigest();path=OUT/(sha+'.txt');path.write_bytes(data)
    return {'text':str(path.relative_to(ROOT)),'sha256':sha}

def pom(group,name,version,seen=()):
    identity=(group,name,version)
    if identity in seen:raise ValueError('POM parent cycle')
    files=sorted((CACHE/group/name/version).rglob('*.pom'))
    if not files:raise ValueError('Missing cached POM '+':'.join(identity))
    raw=files[0].read_bytes();tree=ET.fromstring(raw)
    licenses=[{'name':e.findtext('{*}name'),'url':e.findtext('{*}url')} for e in tree.findall('./{*}licenses/{*}license')]
    parent=tree.find('./{*}parent')
    origin=':'.join(identity)
    if not licenses and parent is not None:
        inherited=pom(*(parent.findtext('{*}'+k) for k in ['groupId','artifactId','version']),seen+(identity,))
        licenses=inherited['licenses'];origin=inherited['licensePom']
    return {'licenses':licenses,'licensePom':origin,'pomSha256':hashlib.sha256(raw).hexdigest(),'source':tree.findtext('./{*}scm/{*}url')}

def embedded(data,prefix=''):
    result=[]
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for name in archive.namelist():
            if name.endswith('/'):continue
            base=name.rsplit('/',1)[-1]
            if re.match(r'(?i)^(license|licence|notice|copying)([._-]|$)',base):
                body=archive.read(name)
                if len(body)>1048576:raise ValueError('Unexpectedly large notice')
                result.append({'originalName':prefix+name,**save(body)})
            if name=='classes.jar':result.extend(embedded(archive.read(name),prefix+'classes.jar!/'))
    return result

apache=save((ROOT/'LICENSE').read_bytes());protobuf=save((ROOT/'docs/licenses/protobuf-BSD-3-Clause.txt').read_bytes())
rows=[]
for item in json.loads((ROOT/'build/reports/licenses/android-runtime.json').read_text()):
    metadata=pom(item['group'],item['name'],item['version'])
    if not metadata['licenses']:raise ValueError('Unresolved licenses '+str(item))
    names=' '.join(x['name'] or '' for x in metadata['licenses'])
    if 'Apache' in names:spdx='Apache-2.0';texts=[apache]
    elif 'BSD-2-Clause' in names:spdx='BSD-2-Clause';texts=[]
    elif 'BSD-3-Clause' in names:spdx='BSD-3-Clause';texts=[protobuf]
    else:raise ValueError('Review new Maven license '+names)
    notices=[];artifacts=[]
    for path in item['artifacts']:
        content=pathlib.Path(path).read_bytes();artifacts.append({'name':pathlib.Path(path).name,'sha256':hashlib.sha256(content).hexdigest()});notices.extend(embedded(content))
    if not notices and not texts:raise ValueError('License text missing '+str(item))
    rows.append({k:item[k] for k in ['group','name','version','configurations']}|metadata|{'license':spdx,'artifacts':artifacts,'licenseTexts':texts,'embeddedNotices':notices})
(ROOT/'legal/dependencies/android-runtime.json').write_text(json.dumps({'scope':'Resolved debug/release runtime Maven artifacts; project modules excluded','protobufNoticeSource':'Google protobuf BSD-3-Clause text retained from official v3.25.5 LICENSE; shaded artifact POM declares BSD-3-Clause, its empty sources JAR does not identify the embedded protobuf revision.','modules':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'resolvedModules':len(rows),'unresolvedLicenses':0,'licenseTypes':sorted(set(x['license'] for x in rows))}))
