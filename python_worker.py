"""Puente JSON delimitado por proceso; no utiliza shell ni dependencias externas."""
import argparse
import importlib.util
import json
import pathlib
import sqlite3
import sys

ROOT=pathlib.Path(__file__).resolve().parent
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    sys.modules[name]=module
    spec.loader.exec_module(module)
    return module
campaign=load('campaign_engine',ROOT/'projects/03-campaignlab/engine.py')
evidence=load('evidence_engine',ROOT/'projects/04-evidencedesk/engine.py')

def run(db,project,action,data):
    if project=='campaigns':
        campaign.init(db);campaign.seed(db)
        if action=='summary':return campaign.summary(db,data.get('start'),data.get('end'))
        if action=='import':return campaign.ingest(db,data.get('rows'))
    if project=='evidence':
        evidence.init(db);evidence.seed(db)
        if action=='list':return {'documents':evidence.documents(db)}
        if action=='search':return evidence.search(db,data.get('query'))
        if action=='import':return evidence.ingest(db,data.get('title'),data.get('content'))
    raise campaign.ValidationError('Acción desconocida.',404)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--db',required=True);parser.add_argument('--project',required=True);parser.add_argument('--action',required=True)
    args=parser.parse_args()
    try:
        raw=sys.stdin.read(262145)
        if len(raw.encode())>262144:raise campaign.ValidationError('Solicitud demasiado grande.',413)
        data=json.loads(raw)
        if not isinstance(data,dict):raise campaign.ValidationError('Se requiere un objeto JSON.')
        with sqlite3.connect(args.db,timeout=5) as db:
            db.execute('PRAGMA foreign_keys=ON')
            result=run(db,args.project,args.action,data)
        print(json.dumps({'ok':True,'data':result},ensure_ascii=False))
    except campaign.ValidationError as error:
        print(json.dumps({'ok':False,'error':str(error),'status':error.status},ensure_ascii=False))
    except (ValueError,TypeError) as error:
        print(json.dumps({'ok':False,'error':'JSON o campos inválidos.','status':400}))
    except Exception:
        print(json.dumps({'ok':False,'error':'No se pudo procesar la operación.','status':500}))
        import traceback
        traceback.print_exc(file=sys.stderr)
