#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CODEV ARCHIVE - SQLite + Flask (verified)
Run:  python codev_archive_db.py
Open: http://localhost:5000
"""

import json, os, csv, io, uuid, subprocess, sys, sqlite3
from datetime import datetime

try:
    from flask import (Flask, request, jsonify, send_file, g, Response)
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'flask'])
    from flask import (Flask, request, jsonify, send_file, g, Response)

# ═══════════════════════════════════════════
# 1. PATH
# ═══════════════════════════════════════════
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

BASE       = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE, 'codev_data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
DB_PATH    = os.path.join(DATA_DIR, 'codev.db')

os.makedirs(DATA_DIR,  exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ═══════════════════════════════════════════
# 2. HELPERS
# ═══════════════════════════════════════════
def uid():
    return uuid.uuid4().hex[:12]

def now_iso():
    return datetime.now().isoformat(timespec='seconds')

# ═══════════════════════════════════════════
# 3. SCHEMA
# ═══════════════════════════════════════════
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS years (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS brands (
    id      TEXT PRIMARY KEY,
    year_id TEXT NOT NULL REFERENCES years(id) ON DELETE CASCADE,
    name    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sub_folders (
    id       TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY,
    brand_id      TEXT REFERENCES brands(id) ON DELETE CASCADE,
    sub_folder_id TEXT REFERENCES sub_folders(id) ON DELETE CASCADE,
    container     TEXT NOT NULL DEFAULT '_direct',
    name          TEXT NOT NULL,
    manager       TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS gate_entries (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    gate           TEXT NOT NULL DEFAULT '',
    year           TEXT DEFAULT '',
    tbd            INTEGER DEFAULT 0,
    decision       TEXT DEFAULT '',
    signature_date TEXT DEFAULT '',
    holding_active INTEGER DEFAULT 0,
    holding_reason TEXT DEFAULT '',
    created_at     TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS gate_reports (
    id            TEXT PRIMARY KEY,
    gate_entry_id TEXT NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
    report_date   TEXT DEFAULT '',
    document      TEXT DEFAULT '',
    doc_type      TEXT DEFAULT '',
    meeting_note  TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS gate_files (
    id            TEXT PRIMARY KEY,
    gate_entry_id TEXT NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    saved_as      TEXT NOT NULL,
    size          INTEGER DEFAULT 0,
    uploaded_at   TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS history (
    id             TEXT PRIMARY KEY,
    brand          TEXT DEFAULT '',
    product        TEXT DEFAULT '',
    project        TEXT DEFAULT '',
    manager        TEXT DEFAULT '',
    gate           TEXT DEFAULT '',
    year           TEXT DEFAULT '',
    tbd            INTEGER DEFAULT 0,
    decision       TEXT DEFAULT '',
    signature_date TEXT DEFAULT '',
    holding_active INTEGER DEFAULT 0,
    holding_reason TEXT DEFAULT '',
    created_at     TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS history_reports (
    id           TEXT PRIMARY KEY,
    history_id   TEXT NOT NULL REFERENCES history(id) ON DELETE CASCADE,
    report_date  TEXT DEFAULT '',
    document     TEXT DEFAULT '',
    doc_type     TEXT DEFAULT '',
    meeting_note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS released (
    key  TEXT PRIMARY KEY,
    data TEXT DEFAULT '{}'
);
"""

DEFAULT_DATA = {
    "2022": {"projects": [
        {"name": "ACTIVIA", "subProjects": [], "products": {"_direct": []}},
        {"name": "YOGURT",  "subProjects": [], "products": {"_direct": []}}
    ]},
    "2023": {"projects": [
        {"name": "ACTIVIA", "subProjects": ["Probiotic","Plain"],
         "products": {"_direct": [], "Probiotic": [], "Plain": []}},
        {"name": "YOGURT",  "subProjects": [], "products": {"_direct": []}}
    ]},
    "2024": {"projects": [
        {"name": "ACTIVIA", "subProjects": [], "products": {"_direct": []}},
        {"name": "YOGURT",  "subProjects": ["Greek","Drink"],
         "products": {"_direct": [], "Greek": [], "Drink": []}}
    ]},
    "2025": {"projects": [
        {"name": "ACTIVIA", "subProjects": [], "products": {"_direct": []}},
        {"name": "YOGURT",  "subProjects": [], "products": {"_direct": []}}
    ]}
}

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM years")
    if cur.fetchone()[0] == 0:
        for yr_name, yr_info in DEFAULT_DATA.items():
            yr_id = uid()
            cur.execute("INSERT INTO years(id,name) VALUES(?,?)", (yr_id, yr_name))
            for proj in yr_info.get("projects", []):
                br_id = uid()
                cur.execute("INSERT INTO brands(id,year_id,name) VALUES(?,?,?)",
                            (br_id, yr_id, proj["name"]))
                for sf_name in proj.get("subProjects", []):
                    sf_id = uid()
                    cur.execute("INSERT INTO sub_folders(id,brand_id,name) VALUES(?,?,?)",
                                (sf_id, br_id, sf_name))
    conn.commit()
    conn.close()

# ═══════════════════════════════════════════
# 4. DB <-> JSON
# ═══════════════════════════════════════════
def _project_row_to_dict(db, p):
    gates = []
    for ge in db.execute("SELECT * FROM gate_entries WHERE project_id=? ORDER BY created_at",
                         (p['id'],)).fetchall():
        reports = []
        for rpt in db.execute("SELECT * FROM gate_reports WHERE gate_entry_id=? ORDER BY rowid",
                              (ge['id'],)).fetchall():
            reports.append({
                "reportDate": rpt['report_date'], "document": rpt['document'],
                "docType": rpt['doc_type'], "meetingNote": rpt['meeting_note']
            })
        files = []
        for fi in db.execute("SELECT * FROM gate_files WHERE gate_entry_id=? ORDER BY rowid",
                             (ge['id'],)).fetchall():
            files.append({"filename": fi['filename'], "savedAs": fi['saved_as'], "size": fi['size']})
        gates.append({
            "gate": ge['gate'], "year": ge['year'], "tbd": bool(ge['tbd']),
            "decision": ge['decision'], "signatureDate": ge['signature_date'],
            "holdingActive": bool(ge['holding_active']),
            "holdingReason": ge['holding_reason'],
            "reports": reports, "files": files
        })
    return {"name": p['name'], "manager": p['manager'] or '', "gates": gates}

def db_to_projects_json(db):
    result = {}
    for yr in db.execute("SELECT * FROM years ORDER BY name").fetchall():
        brands_list = []
        for br in db.execute("SELECT * FROM brands WHERE year_id=? ORDER BY name",
                             (yr['id'],)).fetchall():
            subs = [sf['name'] for sf in
                    db.execute("SELECT * FROM sub_folders WHERE brand_id=? ORDER BY name",
                               (br['id'],)).fetchall()]
            products = {"_direct": []}
            for sf_name in subs:
                products[sf_name] = []
            for p in db.execute(
                    "SELECT * FROM projects WHERE brand_id=? AND container='_direct' ORDER BY name",
                    (br['id'],)).fetchall():
                products["_direct"].append(_project_row_to_dict(db, p))
            for sf in db.execute("SELECT * FROM sub_folders WHERE brand_id=?",
                                 (br['id'],)).fetchall():
                if sf['name'] not in products:
                    products[sf['name']] = []
                for p in db.execute(
                        "SELECT * FROM projects WHERE sub_folder_id=? ORDER BY name",
                        (sf['id'],)).fetchall():
                    products[sf['name']].append(_project_row_to_dict(db, p))
            brands_list.append({"name": br['name'], "subProjects": subs, "products": products})
        result[yr['name']] = {"projects": brands_list}
    return result

def db_to_history_json(db):
    result = []
    for h in db.execute("SELECT * FROM history ORDER BY created_at").fetchall():
        reports = []
        for rpt in db.execute("SELECT * FROM history_reports WHERE history_id=? ORDER BY rowid",
                              (h['id'],)).fetchall():
            reports.append({"reportDate": rpt['report_date'], "document": rpt['document'],
                            "docType": rpt['doc_type'], "meetingNote": rpt['meeting_note']})
        result.append({
            "brand": h['brand'], "product": h['product'], "project": h['project'],
            "manager": h['manager'], "gate": h['gate'], "year": h['year'],
            "tbd": bool(h['tbd']), "decision": h['decision'],
            "signatureDate": h['signature_date'],
            "holdingActive": bool(h['holding_active']),
            "holdingReason": h['holding_reason'], "reports": reports
        })
    return result

def db_to_released_json(db):
    row = db.execute("SELECT data FROM released WHERE key='main'").fetchone()
    if row:
        try: return json.loads(row['data'])
        except Exception: pass
    return {}

def save_projects_to_db(db, data):
    db.execute("DELETE FROM gate_files")
    db.execute("DELETE FROM gate_reports")
    db.execute("DELETE FROM gate_entries")
    db.execute("DELETE FROM projects")
    db.execute("DELETE FROM sub_folders")
    db.execute("DELETE FROM brands")
    db.execute("DELETE FROM years")
    for yr_name, yr_info in data.items():
        yr_id = uid()
        db.execute("INSERT INTO years(id,name) VALUES(?,?)", (yr_id, yr_name))
        for brand in yr_info.get("projects", []):
            br_id = uid()
            db.execute("INSERT INTO brands(id,year_id,name) VALUES(?,?,?)",
                       (br_id, yr_id, brand["name"]))
            sf_map = {}
            for sf_name in brand.get("subProjects", []):
                sf_id = uid()
                db.execute("INSERT INTO sub_folders(id,brand_id,name) VALUES(?,?,?)",
                           (sf_id, br_id, sf_name))
                sf_map[sf_name] = sf_id
            products = brand.get("products", {})
            for container, prod_list in products.items():
                for prod in prod_list:
                    p_id = uid()
                    if container == '_direct':
                        db.execute(
                            "INSERT INTO projects(id,brand_id,container,name,manager) VALUES(?,?,?,?,?)",
                            (p_id, br_id, '_direct', prod.get('name',''), prod.get('manager','')))
                    else:
                        sf_id = sf_map.get(container)
                        db.execute(
                            "INSERT INTO projects(id,brand_id,sub_folder_id,container,name,manager) VALUES(?,?,?,?,?,?)",
                            (p_id, br_id, sf_id, container, prod.get('name',''), prod.get('manager','')))
                    for gate in prod.get('gates', []):
                        ge_id = uid()
                        db.execute("""INSERT INTO gate_entries
                            (id,project_id,gate,year,tbd,decision,signature_date,holding_active,holding_reason)
                            VALUES(?,?,?,?,?,?,?,?,?)""",
                            (ge_id, p_id, gate.get('gate',''), gate.get('year',''),
                             1 if gate.get('tbd') else 0, gate.get('decision',''),
                             gate.get('signatureDate',''),
                             1 if gate.get('holdingActive') else 0,
                             gate.get('holdingReason','')))
                        for rpt in gate.get('reports', []):
                            db.execute("""INSERT INTO gate_reports
                                (id,gate_entry_id,report_date,document,doc_type,meeting_note)
                                VALUES(?,?,?,?,?,?)""",
                                (uid(), ge_id, rpt.get('reportDate',''),
                                 rpt.get('document',''), rpt.get('docType',''),
                                 rpt.get('meetingNote','')))
                        for fi in gate.get('files', []):
                            db.execute("""INSERT INTO gate_files
                                (id,gate_entry_id,filename,saved_as,size)
                                VALUES(?,?,?,?,?)""",
                                (uid(), ge_id, fi.get('filename',''),
                                 fi.get('savedAs',''), fi.get('size',0)))
    db.commit()

def save_history_to_db(db, data):
    db.execute("DELETE FROM history_reports")
    db.execute("DELETE FROM history")
    for rec in data:
        h_id = uid()
        db.execute("""INSERT INTO history
            (id,brand,product,project,manager,gate,year,tbd,decision,signature_date,holding_active,holding_reason)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (h_id, rec.get('brand',''), rec.get('product',''), rec.get('project',''),
             rec.get('manager',''), rec.get('gate',''), rec.get('year',''),
             1 if rec.get('tbd') else 0, rec.get('decision',''),
             rec.get('signatureDate',''),
             1 if rec.get('holdingActive') else 0,
             rec.get('holdingReason','')))
        for rpt in rec.get('reports', []):
            db.execute("""INSERT INTO history_reports
                (id,history_id,report_date,document,doc_type,meeting_note)
                VALUES(?,?,?,?,?,?)""",
                (uid(), h_id, rpt.get('reportDate',''),
                 rpt.get('document',''), rpt.get('docType',''),
                 rpt.get('meetingNote','')))
    db.commit()

def save_released_to_db(db, data):
    db.execute("DELETE FROM released")
    db.execute("INSERT INTO released(key,data) VALUES(?,?)",
               ('main', json.dumps(data, ensure_ascii=False)))
    db.commit()

# ═══════════════════════════════════════════
# 5. ROUTES
# ═══════════════════════════════════════════
@app.route('/')
def index():
    # Return HTML directly (NOT render_template_string) to avoid Jinja2 conflicts
    return Response(get_html(), mimetype='text/html')

@app.route('/api/data', methods=['GET'])
def api_get_data():
    db = get_db()
    return jsonify({
        'projects': db_to_projects_json(db),
        'history':  db_to_history_json(db),
        'released': db_to_released_json(db)
    })

@app.route('/api/data', methods=['POST'])
def api_save_data():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'No data'}), 400
    db = get_db()
    if 'projects' in data:
        save_projects_to_db(db, data['projects'])
    if 'history' in data:
        save_history_to_db(db, data['history'])
    if 'released' in data:
        save_released_to_db(db, data['released'])
    return jsonify({'ok': True})

@app.route('/api/data', methods=['DELETE'])
def api_clear_data():
    db = get_db()
    for tbl in ['gate_files','gate_reports','gate_entries','projects',
                'sub_folders','brands','years','history_reports','history','released']:
        db.execute("DELETE FROM " + tbl)
    db.commit()
    for fn in os.listdir(UPLOAD_DIR):
        fp = os.path.join(UPLOAD_DIR, fn)
        if os.path.isfile(fp):
            os.remove(fp)
    return jsonify({'ok': True})

@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
    safe = uid() + '_' + f.filename
    fpath = os.path.join(UPLOAD_DIR, safe)
    f.save(fpath)
    return jsonify({'ok': True, 'filename': f.filename, 'savedAs': safe,
                    'size': os.path.getsize(fpath)})

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_file(os.path.join(UPLOAD_DIR, filename))

@app.route('/api/export')
def api_export():
    db = get_db()
    history = db_to_history_json(db)
    out = io.StringIO()
    out.write('\ufeff')
    w = csv.writer(out)
    w.writerow(['No','Brand','Product','Project','Manager','Gate','Date',
                'Report Date','Document','Type','Note','Sign Date','Holding','Reason'])
    for i, rec in enumerate(history):
        yr = 'TBD' if rec.get('tbd') else (rec.get('year') or '-')
        ha = 'Y' if rec.get('holdingActive') else 'N'
        reports = rec.get('reports') or []
        if reports:
            for j, rpt in enumerate(reports):
                row = [
                    i+1 if j==0 else '', rec.get('brand','') if j==0 else '',
                    rec.get('product','') if j==0 else '', rec.get('project','') if j==0 else '',
                    rec.get('manager','') if j==0 else '', rec.get('gate','') if j==0 else '',
                    yr if j==0 else '',
                    rpt.get('reportDate','-'), rpt.get('document','-'),
                    rpt.get('docType','-'), rpt.get('meetingNote','-'),
                    rec.get('signatureDate','-') if j==0 else '',
                    ha if j==0 else '', rec.get('holdingReason','-') if j==0 else ''
                ]
                w.writerow(row)
        else:
            w.writerow([i+1, rec.get('brand',''), rec.get('product',''),
                        rec.get('project',''), rec.get('manager',''),
                        rec.get('gate',''), yr, '-','-','-','-',
                        rec.get('signatureDate','-'), ha, rec.get('holdingReason','-')])
    out.seek(0)
    fname = "CODEV_History_" + datetime.now().strftime('%Y-%m-%d') + ".csv"
    return send_file(io.BytesIO(out.getvalue().encode('utf-8-sig')),
                     mimetype='text/csv', as_attachment=True, download_name=fname)

@app.route('/api/stats')
def api_stats():
    db = get_db()
    stats = {}
    for tbl in ['years','brands','sub_folders','projects',
                'gate_entries','gate_reports','gate_files',
                'history','history_reports']:
        stats[tbl] = db.execute("SELECT COUNT(*) FROM " + tbl).fetchone()[0]
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    stats['db_size_kb'] = round(db_size / 1024, 1)
    return jsonify(stats)

# ═══════════════════════════════════════════
# 6. HTML (function, not variable — avoids encoding issues)
# ═══════════════════════════════════════════
def get_html():
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CODEV ARCHIVE</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f0f2f5;color:#333}
.header{background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.header h1{font-size:20px;letter-spacing:1px}
.header-actions button{background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:6px 14px;border-radius:4px;cursor:pointer;margin-left:8px;font-size:12px;transition:.2s}
.header-actions button:hover{background:rgba(255,255,255,.3)}
.tabs{display:flex;background:#283593;padding:0 24px}
.tab{color:rgba(255,255,255,.6);padding:10px 20px;cursor:pointer;font-size:13px;border-bottom:3px solid transparent;transition:.2s}
.tab:hover{color:#fff}
.tab.active{color:#fff;border-bottom-color:#ff9800;font-weight:600}
.main{display:flex;height:calc(100vh - 100px);overflow:hidden}
.panel{background:#fff;border-right:1px solid #e0e0e0;overflow-y:auto;min-width:0}
.panel-year{width:120px;min-width:120px}
.panel-brand{width:200px;min-width:200px}
.panel-product{flex:1}
.panel-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;font-weight:600;font-size:13px;position:sticky;top:0;z-index:1}
.panel-header button{background:#1a237e;color:#fff;border:none;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:11px}
.list-item{padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;transition:.1s;display:flex;align-items:center;justify-content:space-between}
.list-item:hover{background:#e8eaf6}
.list-item.active{background:#c5cae9;font-weight:600}
.list-item .item-actions{display:none;gap:4px}
.list-item:hover .item-actions{display:flex}
.item-actions button{background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;border-radius:2px}
.item-actions .edit-btn{color:#1565c0}
.item-actions .del-btn{color:#c62828}
.sub-folder{padding-left:20px;font-size:12px;color:#555}
.sub-folder::before{content:'\\2514  ';color:#999}
.product-card{background:#fff;border:1px solid #e0e0e0;border-radius:6px;margin:8px 12px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.product-card h3{font-size:14px;color:#1a237e;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}
.product-card h3 .card-actions button{font-size:11px;margin-left:4px;padding:2px 6px;border:1px solid #ccc;border-radius:3px;cursor:pointer;background:#fff}
.gate-section{margin-top:8px;padding:8px;background:#fafafa;border-radius:4px;border:1px solid #eee}
.gate-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.gate-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;margin-right:6px}
.gate-badge.tbd{background:#ff9800}
.gate-badge.gate{background:#1565c0}
.gate-info{font-size:12px;color:#555;margin:4px 0}
.gate-info span{margin-right:12px}
.report-row{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;border-top:1px solid #f0f0f0}
.report-row span{flex:1}
.file-chip{display:inline-block;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:10px;font-size:11px;margin:2px;cursor:pointer}
.holding-badge{background:#ff5722;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px}
.decision-badge{background:#4caf50;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px}
.history-panel{flex:1;overflow:auto;padding:12px}
.history-table{width:100%;border-collapse:collapse;font-size:12px}
.history-table th{background:#1a237e;color:#fff;padding:8px 6px;text-align:left;position:sticky;top:0;z-index:1}
.history-table td{padding:6px;border-bottom:1px solid #eee}
.history-table tr:hover td{background:#e8eaf6}
.holding-panel{flex:1;overflow:auto;padding:12px}
.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:1000}
.modal-overlay.show{display:flex}
.modal{background:#fff;border-radius:8px;padding:20px;min-width:380px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.3)}
.modal h2{font-size:16px;margin-bottom:12px;color:#1a237e}
.modal label{display:block;font-size:12px;font-weight:600;margin:8px 0 4px;color:#555}
.modal input,.modal select,.modal textarea{width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px}
.modal textarea{resize:vertical;min-height:60px}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.modal-footer button{padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px}
.btn-primary{background:#1a237e;color:#fff}
.btn-danger{background:#c62828;color:#fff}
.btn-secondary{background:#e0e0e0;color:#333}
.btn-success{background:#2e7d32;color:#fff}
.btn-warning{background:#f57f17;color:#fff}
.toast{position:fixed;bottom:24px;right:24px;background:#323232;color:#fff;padding:12px 20px;border-radius:6px;font-size:13px;z-index:2000;opacity:0;transition:.3s;pointer-events:none}
.toast.show{opacity:1}
.stats-bar{font-size:11px;color:rgba(255,255,255,.7);display:flex;gap:12px;align-items:center}
.stats-bar span{background:rgba(255,255,255,.1);padding:2px 8px;border-radius:10px}
.tab-content{display:none;flex:1;overflow:hidden}
.tab-content.active{display:flex;flex-direction:column}
.archive-content{display:flex;flex:1;overflow:hidden}
</style>
</head>
<body>
<div class="header">
  <h1>CODEV ARCHIVE</h1>
  <div class="stats-bar" id="statsBar"></div>
  <div class="header-actions">
    <button onclick="exportCSV()">Export CSV</button>
    <button onclick="showStats()">DB Stats</button>
    <button onclick="clearAll()">Clear All</button>
  </div>
</div>
<div class="tabs">
  <div class="tab active" data-tab="archive">Archive</div>
  <div class="tab" data-tab="ongoing">Ongoing Projects</div>
  <div class="tab" data-tab="history">History</div>
  <div class="tab" data-tab="holding">Holding</div>
</div>
<div class="tab-content active" id="tab-archive">
  <div class="archive-content">
    <div class="panel panel-year">
      <div class="panel-header"><span>Year</span><button onclick="addYear()">+</button></div>
      <div id="yearList"></div>
    </div>
    <div class="panel panel-brand">
      <div class="panel-header"><span>Brand</span><button onclick="addBrand()">+</button></div>
      <div id="brandList"></div>
    </div>
    <div class="panel panel-product">
      <div class="panel-header"><span>Products</span><button onclick="addProduct()">+ Product</button></div>
      <div id="productList"></div>
    </div>
  </div>
</div>
<div class="tab-content" id="tab-ongoing">
  <div class="history-panel" id="ongoingPanel">
    <h3 style="margin-bottom:12px;color:#1a237e">Ongoing Projects (TBD / No Decision)</h3>
    <table class="history-table">
      <thead><tr><th>No</th><th>Brand</th><th>Product</th><th>Project</th><th>Manager</th><th>Gate</th><th>Date</th><th>Report Date</th><th>Document</th><th>Type</th><th>Note</th></tr></thead>
      <tbody id="ongoingBody"></tbody>
    </table>
  </div>
</div>
<div class="tab-content" id="tab-history">
  <div class="history-panel" id="historyPanel">
    <h3 style="margin-bottom:12px;color:#1a237e">History (Completed)</h3>
    <table class="history-table">
      <thead><tr><th>No</th><th>Brand</th><th>Product</th><th>Project</th><th>Manager</th><th>Gate</th><th>Date</th><th>Sign Date</th><th>Report Date</th><th>Document</th><th>Type</th><th>Note</th></tr></thead>
      <tbody id="historyBody"></tbody>
    </table>
  </div>
</div>
<div class="tab-content" id="tab-holding">
  <div class="holding-panel" id="holdingPanel">
    <h3 style="margin-bottom:12px;color:#ff5722">Holding Projects</h3>
    <table class="history-table">
      <thead><tr><th>No</th><th>Brand</th><th>Product</th><th>Project</th><th>Manager</th><th>Gate</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody id="holdingBody"></tbody>
    </table>
  </div>
</div>
<div class="modal-overlay" id="modalOverlay">
  <div class="modal" id="modalContent"></div>
</div>
<div class="toast" id="toast"></div>

<script>
/* ========== STATE ========== */
var projectData = {};
var historyRecords = [];
var releasedFiles = {};
var selectedYear = null;
var selectedBrand = null;
var selectedSubFolder = null;

/* ========== API ========== */
var API = {
  getData: function() {
    return fetch('/api/data').then(function(r){ return r.json(); });
  },
  saveData: function(d) {
    return fetch('/api/data', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(d)
    });
  },
  clearData: function() {
    return fetch('/api/data', {method:'DELETE'});
  },
  upload: function(formData) {
    return fetch('/api/upload', {method:'POST', body: formData}).then(function(r){ return r.json(); });
  }
};

/* ========== TOAST ========== */
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

/* ========== MODAL ========== */
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

/* ========== LOAD / SAVE ========== */
function loadAll() {
  API.getData().then(function(d) {
    projectData = d.projects || {};
    historyRecords = d.history || [];
    releasedFiles = d.released || {};
    renderAll();
  });
}
function saveAll() {
  return API.saveData({
    projects: projectData,
    history: historyRecords,
    released: releasedFiles
  }).then(function(){ toast('Saved'); });
}

/* ========== RENDER ALL ========== */
function renderAll() {
  renderYears();
  renderOngoing();
  renderHistory();
  renderHolding();
  loadStats();
}

/* ========== YEARS ========== */
function renderYears() {
  var el = document.getElementById('yearList');
  var years = Object.keys(projectData).sort();
  var html = '';
  for (var i = 0; i < years.length; i++) {
    var y = years[i];
    var cls = (y === selectedYear) ? 'list-item active' : 'list-item';
    html += '<div class="' + cls + '" onclick="selectYear(\\''+y+'\\')">' +
      '<span>' + y + '</span>' +
      '<span class="item-actions">' +
      '<button class="edit-btn" onclick="event.stopPropagation();editYear(\\''+y+'\\')">Edit</button>' +
      '<button class="del-btn" onclick="event.stopPropagation();deleteYear(\\''+y+'\\')">Del</button>' +
      '</span></div>';
  }
  el.innerHTML = html;
  if (selectedYear && projectData[selectedYear]) {
    renderBrands();
  } else {
    document.getElementById('brandList').innerHTML = '';
    document.getElementById('productList').innerHTML = '';
  }
}
function selectYear(y) {
  selectedYear = y; selectedBrand = null; selectedSubFolder = null;
  renderYears();
}
function addYear() {
  openModal('<h2>Add Year</h2><label>Year</label>' +
    '<input id="mYear" type="number" value="' + new Date().getFullYear() + '">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddYear()">Add</button></div>');
}
function doAddYear() {
  var y = document.getElementById('mYear').value.trim();
  if (!y) return;
  if (projectData[y]) { toast('Already exists'); return; }
  projectData[y] = { projects: [] };
  selectedYear = y;
  saveAll().then(function(){ renderAll(); closeModal(); });
}
function editYear(old) {
  openModal('<h2>Rename Year</h2><label>Year</label>' +
    '<input id="mYear" value="' + old + '">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doEditYear(\\''+old+'\\')">Save</button></div>');
}
function doEditYear(old) {
  var nw = document.getElementById('mYear').value.trim();
  if (!nw || nw === old) { closeModal(); return; }
  projectData[nw] = projectData[old];
  delete projectData[old];
  if (selectedYear === old) selectedYear = nw;
  saveAll().then(function(){ renderAll(); closeModal(); });
}
function deleteYear(y) {
  if (!confirm('Delete year "' + y + '" and all data?')) return;
  delete projectData[y];
  if (selectedYear === y) { selectedYear = null; selectedBrand = null; }
  saveAll().then(function(){ renderAll(); });
}

/* ========== BRANDS ========== */
function renderBrands() {
  var el = document.getElementById('brandList');
  if (!selectedYear || !projectData[selectedYear]) { el.innerHTML = ''; return; }
  var brands = projectData[selectedYear].projects || [];
  var html = '';
  for (var bi = 0; bi < brands.length; bi++) {
    var br = brands[bi];
    var isActive = (selectedBrand === bi && selectedSubFolder === null);
    html += '<div class="list-item' + (isActive?' active':'') + '" onclick="selectBrand('+bi+')">' +
      '<span>' + br.name + '</span>' +
      '<span class="item-actions">' +
      '<button class="edit-btn" onclick="event.stopPropagation();editBrand('+bi+')">Edit</button>' +
      '<button class="del-btn" onclick="event.stopPropagation();deleteBrand('+bi+')">Del</button>' +
      '<button class="edit-btn" onclick="event.stopPropagation();addSubFolder('+bi+')">+Sub</button>' +
      '</span></div>';
    var subs = br.subProjects || [];
    for (var si = 0; si < subs.length; si++) {
      var sf = subs[si];
      var sfActive = (selectedBrand === bi && selectedSubFolder === sf);
      html += '<div class="list-item sub-folder' + (sfActive?' active':'') + '" onclick="selectSubFolder('+bi+',\\''+sf.replace(/'/g,"\\\\'")+'\\')">'+
        '<span>' + sf + '</span>' +
        '<span class="item-actions">' +
        '<button class="edit-btn" onclick="event.stopPropagation();editSubFolder('+bi+','+si+')">Edit</button>' +
        '<button class="del-btn" onclick="event.stopPropagation();deleteSubFolder('+bi+','+si+')">Del</button>' +
        '</span></div>';
    }
  }
  el.innerHTML = html;
  renderProducts();
}
function selectBrand(bi) {
  selectedBrand = bi; selectedSubFolder = null;
  renderBrands();
}
function selectSubFolder(bi, sf) {
  selectedBrand = bi; selectedSubFolder = sf;
  renderBrands();
}
function addBrand() {
  if (!selectedYear) { toast('Select a year first'); return; }
  openModal('<h2>Add Brand</h2><label>Brand Name</label><input id="mBrand">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddBrand()">Add</button></div>');
}
function doAddBrand() {
  var name = document.getElementById('mBrand').value.trim();
  if (!name) return;
  if (!projectData[selectedYear].projects) projectData[selectedYear].projects = [];
  projectData[selectedYear].projects.push({ name: name, subProjects: [], products: { _direct: [] } });
  saveAll().then(function(){ renderBrands(); closeModal(); });
}
function editBrand(bi) {
  var br = projectData[selectedYear].projects[bi];
  openModal('<h2>Edit Brand</h2><label>Brand Name</label><input id="mBrand" value="'+br.name+'">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doEditBrand('+bi+')">Save</button></div>');
}
function doEditBrand(bi) {
  var name = document.getElementById('mBrand').value.trim();
  if (!name) return;
  projectData[selectedYear].projects[bi].name = name;
  saveAll().then(function(){ renderBrands(); closeModal(); });
}
function deleteBrand(bi) {
  var br = projectData[selectedYear].projects[bi];
  if (!confirm('Delete brand "'+br.name+'"?')) return;
  projectData[selectedYear].projects.splice(bi, 1);
  if (selectedBrand === bi) { selectedBrand = null; selectedSubFolder = null; }
  saveAll().then(function(){ renderBrands(); });
}
function addSubFolder(bi) {
  openModal('<h2>Add Sub-Folder</h2><label>Name</label><input id="mSub">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddSubFolder('+bi+')">Add</button></div>');
}
function doAddSubFolder(bi) {
  var name = document.getElementById('mSub').value.trim();
  if (!name) return;
  var br = projectData[selectedYear].projects[bi];
  if (!br.subProjects) br.subProjects = [];
  br.subProjects.push(name);
  if (!br.products) br.products = { _direct: [] };
  br.products[name] = [];
  saveAll().then(function(){ renderBrands(); closeModal(); });
}
function editSubFolder(bi, si) {
  var br = projectData[selectedYear].projects[bi];
  var old = br.subProjects[si];
  openModal('<h2>Edit Sub-Folder</h2><label>Name</label><input id="mSub" value="'+old+'">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doEditSubFolder('+bi+','+si+',\\''+old.replace(/'/g,"\\\\'")+'\\')">Save</button></div>');
}
function doEditSubFolder(bi, si, old) {
  var nw = document.getElementById('mSub').value.trim();
  if (!nw) return;
  var br = projectData[selectedYear].projects[bi];
  br.subProjects[si] = nw;
  if (br.products && br.products[old]) {
    br.products[nw] = br.products[old];
    delete br.products[old];
  }
  if (selectedSubFolder === old) selectedSubFolder = nw;
  saveAll().then(function(){ renderBrands(); closeModal(); });
}
function deleteSubFolder(bi, si) {
  var br = projectData[selectedYear].projects[bi];
  var sf = br.subProjects[si];
  if (!confirm('Delete sub-folder "'+sf+'"?')) return;
  br.subProjects.splice(si, 1);
  if (br.products) delete br.products[sf];
  if (selectedSubFolder === sf) selectedSubFolder = null;
  saveAll().then(function(){ renderBrands(); });
}

/* ========== PRODUCTS ========== */
function renderProducts() {
  var el = document.getElementById('productList');
  if (selectedBrand === null || !selectedYear) { el.innerHTML = ''; return; }
  var br = projectData[selectedYear].projects[selectedBrand];
  if (!br) { el.innerHTML = ''; return; }
  var container = selectedSubFolder || '_direct';
  var prods = (br.products && br.products[container]) || [];
  if (!prods.length) {
    el.innerHTML = '<div style="padding:20px;color:#999;text-align:center">No products. Click "+ Product" to add.</div>';
    return;
  }
  var html = '';
  for (var pi = 0; pi < prods.length; pi++) {
    html += renderProductCard(prods[pi], pi, container);
  }
  el.innerHTML = html;
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderProductCard(p, pi, container) {
  var gatesHtml = '';
  var gates = p.gates || [];
  for (var gi = 0; gi < gates.length; gi++) {
    var gate = gates[gi];
    var badge = gate.tbd
      ? '<span class="gate-badge tbd">TBD</span>'
      : '<span class="gate-badge gate">' + esc(gate.gate || 'N/A') + '</span>';
    if (gate.holdingActive) badge += '<span class="holding-badge">HOLDING</span>';
    if (gate.decision) badge += '<span class="decision-badge">' + esc(gate.decision) + '</span>';

    var reportsHtml = '';
    var rpts = gate.reports || [];
    for (var ri = 0; ri < rpts.length; ri++) {
      var r = rpts[ri];
      reportsHtml += '<div class="report-row">' +
        '<span>' + esc(r.reportDate||'-') + '</span>' +
        '<span>' + esc(r.document||'-') + '</span>' +
        '<span>' + esc(r.docType||'-') + '</span>' +
        '<span>' + esc(r.meetingNote||'-') + '</span>' +
        '<button style="font-size:10px;color:#c62828;background:none;border:none;cursor:pointer" ' +
        'onclick="deleteReport('+pi+',\\''+container+'\\','+gi+','+ri+')">x</button></div>';
    }

    var filesHtml = '';
    var files = gate.files || [];
    for (var fi = 0; fi < files.length; fi++) {
      filesHtml += '<span class="file-chip" onclick="window.open(\\'/uploads/'+files[fi].savedAs+'\\')">' +
        esc(files[fi].filename) + '</span>';
    }

    gatesHtml += '<div class="gate-section">' +
      '<div class="gate-header"><div>' + badge + '</div><div>' +
      '<button style="font-size:10px" onclick="editGate('+pi+',\\''+container+'\\','+gi+')">Edit</button> ' +
      '<button style="font-size:10px" onclick="addReport('+pi+',\\''+container+'\\','+gi+')">+Report</button> ' +
      '<button style="font-size:10px" onclick="uploadFile('+pi+',\\''+container+'\\','+gi+')">+File</button> ' +
      '<button style="font-size:10px" onclick="toggleHolding('+pi+',\\''+container+'\\','+gi+')">' + (gate.holdingActive?'Unhold':'Hold') + '</button> ' +
      '<button style="font-size:10px;color:#c62828" onclick="deleteGate('+pi+',\\''+container+'\\','+gi+')">Del</button>' +
      '</div></div>' +
      '<div class="gate-info">' +
      '<span>Year: ' + (gate.tbd ? 'TBD' : esc(gate.year||'-')) + '</span>' +
      '<span>Sign: ' + esc(gate.signatureDate||'-') + '</span>' +
      (gate.holdingReason ? '<span>Reason: '+esc(gate.holdingReason)+'</span>' : '') +
      '</div>' +
      (reportsHtml ? '<div style="margin-top:4px">'+reportsHtml+'</div>' : '') +
      (filesHtml ? '<div style="margin-top:4px">'+filesHtml+'</div>' : '') +
      '</div>';
  }

  return '<div class="product-card"><h3>' +
    '<span>' + esc(p.name) + (p.manager ? ' <small style="color:#777">- '+esc(p.manager)+'</small>' : '') + '</span>' +
    '<span class="card-actions">' +
    '<button onclick="addGate('+pi+',\\''+container+'\\')">+Gate</button>' +
    '<button onclick="editProduct('+pi+',\\''+container+'\\')">Edit</button>' +
    '<button onclick="releaseProduct('+pi+',\\''+container+'\\')">Release</button>' +
    '<button style="color:#c62828" onclick="deleteProduct('+pi+',\\''+container+'\\')">Del</button>' +
    '</span></h3>' + gatesHtml + '</div>';
}

/* ========== PRODUCT CRUD ========== */
function addProduct() {
  if (selectedBrand === null) { toast('Select a brand first'); return; }
  openModal('<h2>Add Product</h2>' +
    '<label>Product Name</label><input id="mProdName">' +
    '<label>Manager</label><input id="mProdMgr">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddProduct()">Add</button></div>');
}
function doAddProduct() {
  var name = document.getElementById('mProdName').value.trim();
  var mgr = document.getElementById('mProdMgr').value.trim();
  if (!name) return;
  var br = projectData[selectedYear].projects[selectedBrand];
  var container = selectedSubFolder || '_direct';
  if (!br.products) br.products = { _direct: [] };
  if (!br.products[container]) br.products[container] = [];
  br.products[container].push({ name: name, manager: mgr, gates: [] });
  saveAll().then(function(){ renderProducts(); closeModal(); });
}
function editProduct(pi, container) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var p = br.products[container][pi];
  openModal('<h2>Edit Product</h2>' +
    '<label>Product Name</label><input id="mProdName" value="'+esc(p.name)+'">' +
    '<label>Manager</label><input id="mProdMgr" value="'+esc(p.manager||'')+'">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doEditProduct('+pi+',\\''+container+'\\')">Save</button></div>');
}
function doEditProduct(pi, container) {
  var br = projectData[selectedYear].projects[selectedBrand];
  br.products[container][pi].name = document.getElementById('mProdName').value.trim();
  br.products[container][pi].manager = document.getElementById('mProdMgr').value.trim();
  saveAll().then(function(){ renderProducts(); closeModal(); });
}
function deleteProduct(pi, container) {
  if (!confirm('Delete this product?')) return;
  var br = projectData[selectedYear].projects[selectedBrand];
  br.products[container].splice(pi, 1);
  saveAll().then(function(){ renderProducts(); });
}
function releaseProduct(pi, container) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var p = br.products[container][pi];
  if (!confirm('Release "'+p.name+'" to history?')) return;
  var gates = p.gates || [];
  for (var i = 0; i < gates.length; i++) {
    var gate = gates[i];
    historyRecords.push({
      brand: br.name, product: p.name, project: p.name,
      manager: p.manager || '', gate: gate.gate || '',
      year: gate.year || '', tbd: gate.tbd || false,
      decision: gate.decision || '', signatureDate: gate.signatureDate || '',
      holdingActive: gate.holdingActive || false, holdingReason: gate.holdingReason || '',
      reports: gate.reports || []
    });
  }
  br.products[container].splice(pi, 1);
  saveAll().then(function(){ renderAll(); toast('Released to history'); });
}

/* ========== GATE CRUD ========== */
function addGate(pi, container) {
  openModal('<h2>Add Gate</h2>' +
    '<label>Gate</label><select id="mGate">' +
    '<option value="Gate 0">Gate 0</option><option value="Gate 1">Gate 1</option>' +
    '<option value="Gate 2">Gate 2</option><option value="Gate 3">Gate 3</option>' +
    '<option value="Gate 4">Gate 4</option><option value="Gate 5">Gate 5</option>' +
    '<option value="Post Launch">Post Launch</option></select>' +
    '<label>Year</label><input id="mGateYear" value="'+(selectedYear||'')+'">' +
    '<label><input type="checkbox" id="mGateTbd"> TBD</label>' +
    '<label>Decision</label><input id="mGateDec">' +
    '<label>Signature Date</label><input id="mGateSign" type="date">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddGate('+pi+',\\''+container+'\\')">Add</button></div>');
}
function doAddGate(pi, container) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var p = br.products[container][pi];
  if (!p.gates) p.gates = [];
  p.gates.push({
    gate: document.getElementById('mGate').value,
    year: document.getElementById('mGateYear').value,
    tbd: document.getElementById('mGateTbd').checked,
    decision: document.getElementById('mGateDec').value,
    signatureDate: document.getElementById('mGateSign').value,
    holdingActive: false, holdingReason: '', reports: [], files: []
  });
  saveAll().then(function(){ renderProducts(); closeModal(); });
}
function editGate(pi, container, gi) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var gate = br.products[container][pi].gates[gi];
  var opts = ['Gate 0','Gate 1','Gate 2','Gate 3','Gate 4','Gate 5','Post Launch'];
  var optHtml = '';
  for (var i=0;i<opts.length;i++) {
    optHtml += '<option'+(gate.gate===opts[i]?' selected':'')+'>'+opts[i]+'</option>';
  }
  openModal('<h2>Edit Gate</h2>' +
    '<label>Gate</label><select id="mGate">'+optHtml+'</select>' +
    '<label>Year</label><input id="mGateYear" value="'+esc(gate.year||'')+'">' +
    '<label><input type="checkbox" id="mGateTbd"'+(gate.tbd?' checked':'')+'> TBD</label>' +
    '<label>Decision</label><input id="mGateDec" value="'+esc(gate.decision||'')+'">' +
    '<label>Signature Date</label><input id="mGateSign" type="date" value="'+(gate.signatureDate||'')+'">' +
    '<label>Holding Reason</label><textarea id="mGateHold">'+esc(gate.holdingReason||'')+'</textarea>' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doEditGate('+pi+',\\''+container+'\\','+gi+')">Save</button></div>');
}
function doEditGate(pi, container, gi) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var gate = br.products[container][pi].gates[gi];
  gate.gate = document.getElementById('mGate').value;
  gate.year = document.getElementById('mGateYear').value;
  gate.tbd = document.getElementById('mGateTbd').checked;
  gate.decision = document.getElementById('mGateDec').value;
  gate.signatureDate = document.getElementById('mGateSign').value;
  gate.holdingReason = document.getElementById('mGateHold').value;
  saveAll().then(function(){ renderProducts(); closeModal(); });
}
function deleteGate(pi, container, gi) {
  if (!confirm('Delete this gate?')) return;
  var br = projectData[selectedYear].projects[selectedBrand];
  br.products[container][pi].gates.splice(gi, 1);
  saveAll().then(function(){ renderProducts(); });
}
function toggleHolding(pi, container, gi) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var gate = br.products[container][pi].gates[gi];
  if (!gate.holdingActive) {
    openModal('<h2>Set Holding</h2>' +
      '<label>Holding Reason</label><textarea id="mHoldReason"></textarea>' +
      '<div class="modal-footer">' +
      '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button class="btn-warning" onclick="doSetHolding('+pi+',\\''+container+'\\','+gi+')">Hold</button></div>');
  } else {
    gate.holdingActive = false;
    gate.holdingReason = '';
    saveAll().then(function(){ renderAll(); toast('Holding released'); });
  }
}
function doSetHolding(pi, container, gi) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var gate = br.products[container][pi].gates[gi];
  gate.holdingActive = true;
  gate.holdingReason = document.getElementById('mHoldReason').value;
  saveAll().then(function(){ renderAll(); closeModal(); toast('Set to holding'); });
}

/* ========== REPORT ========== */
function addReport(pi, container, gi) {
  openModal('<h2>Add Report</h2>' +
    '<label>Report Date</label><input id="mRptDate" type="date">' +
    '<label>Document</label><input id="mRptDoc">' +
    '<label>Type</label><select id="mRptType">' +
    '<option value="PPT">PPT</option><option value="Excel">Excel</option>' +
    '<option value="PDF">PDF</option><option value="Other">Other</option></select>' +
    '<label>Meeting Note</label><textarea id="mRptNote"></textarea>' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doAddReport('+pi+',\\''+container+'\\','+gi+')">Add</button></div>');
}
function doAddReport(pi, container, gi) {
  var br = projectData[selectedYear].projects[selectedBrand];
  var gate = br.products[container][pi].gates[gi];
  if (!gate.reports) gate.reports = [];
  gate.reports.push({
    reportDate: document.getElementById('mRptDate').value,
    document: document.getElementById('mRptDoc').value,
    docType: document.getElementById('mRptType').value,
    meetingNote: document.getElementById('mRptNote').value
  });
  saveAll().then(function(){ renderProducts(); closeModal(); });
}
function deleteReport(pi, container, gi, ri) {
  if (!confirm('Delete this report?')) return;
  var br = projectData[selectedYear].projects[selectedBrand];
  br.products[container][pi].gates[gi].reports.splice(ri, 1);
  saveAll().then(function(){ renderProducts(); });
}

/* ========== FILE UPLOAD ========== */
function uploadFile(pi, container, gi) {
  openModal('<h2>Upload File</h2><input type="file" id="mFileInput">' +
    '<div class="modal-footer">' +
    '<button class="btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn-primary" onclick="doUploadFile('+pi+',\\''+container+'\\','+gi+')">Upload</button></div>');
}
function doUploadFile(pi, container, gi) {
  var input = document.getElementById('mFileInput');
  if (!input.files.length) return;
  var fd = new FormData();
  fd.append('file', input.files[0]);
  API.upload(fd).then(function(res) {
    if (res.ok) {
      var br = projectData[selectedYear].projects[selectedBrand];
      var gate = br.products[container][pi].gates[gi];
      if (!gate.files) gate.files = [];
      gate.files.push({ filename: res.filename, savedAs: res.savedAs, size: res.size });
      saveAll().then(function(){ renderProducts(); closeModal(); toast('File uploaded'); });
    } else {
      toast('Upload failed: ' + (res.error||''));
    }
  });
}

/* ========== ONGOING ========== */
function renderOngoing() {
  var body = document.getElementById('ongoingBody');
  var rows = '';
  var no = 0;
  var years = Object.keys(projectData);
  for (var yi = 0; yi < years.length; yi++) {
    var yr = years[yi];
    var yd = projectData[yr];
    var brands = yd.projects || [];
    for (var bi = 0; bi < brands.length; bi++) {
      var br = brands[bi];
      var containers = Object.keys(br.products || {});
      for (var ci = 0; ci < containers.length; ci++) {
        var cont = containers[ci];
        var prods = br.products[cont];
        for (var pi = 0; pi < prods.length; pi++) {
          var p = prods[pi];
          var gates = p.gates || [];
          for (var gi = 0; gi < gates.length; gi++) {
            var gate = gates[gi];
            if (gate.tbd || !gate.decision) {
              no++;
              var rpts = gate.reports && gate.reports.length ? gate.reports : [{}];
              for (var ri = 0; ri < rpts.length; ri++) {
                var r = rpts[ri];
                rows += '<tr>';
                if (ri === 0) {
                  rows += '<td rowspan="'+rpts.length+'">'+no+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+esc(br.name)+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+(cont==='_direct'?'-':esc(cont))+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+esc(p.name)+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+esc(p.manager||'-')+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+esc(gate.gate||'-')+'</td>' +
                    '<td rowspan="'+rpts.length+'">'+(gate.tbd?'TBD':esc(gate.year||'-'))+'</td>';
                }
                rows += '<td>'+esc(r.reportDate||'-')+'</td>' +
                  '<td>'+esc(r.document||'-')+'</td>' +
                  '<td>'+esc(r.docType||'-')+'</td>' +
                  '<td>'+esc(r.meetingNote||'-')+'</td></tr>';
              }
            }
          }
        }
      }
    }
  }
  body.innerHTML = rows || '<tr><td colspan="11" style="text-align:center;padding:20px;color:#999">No ongoing projects</td></tr>';
}

/* ========== HISTORY ========== */
function renderHistory() {
  var body = document.getElementById('historyBody');
  if (!historyRecords.length) {
    body.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:#999">No history</td></tr>';
    return;
  }
  var rows = '';
  for (var i = 0; i < historyRecords.length; i++) {
    var rec = historyRecords[i];
    var rpts = rec.reports && rec.reports.length ? rec.reports : [{}];
    for (var ri = 0; ri < rpts.length; ri++) {
      var r = rpts[ri];
      rows += '<tr>';
      if (ri === 0) {
        rows += '<td rowspan="'+rpts.length+'">'+(i+1)+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.brand||'-')+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.product||'-')+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.project||'-')+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.manager||'-')+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.gate||'-')+'</td>' +
          '<td rowspan="'+rpts.length+'">'+(rec.tbd?'TBD':esc(rec.year||'-'))+'</td>' +
          '<td rowspan="'+rpts.length+'">'+esc(rec.signatureDate||'-')+'</td>';
      }
      rows += '<td>'+esc(r.reportDate||'-')+'</td>' +
        '<td>'+esc(r.document||'-')+'</td>' +
        '<td>'+esc(r.docType||'-')+'</td>' +
        '<td>'+esc(r.meetingNote||'-')+'</td></tr>';
    }
  }
  body.innerHTML = rows;
}

/* ========== HOLDING ========== */
function renderHolding() {
  var body = document.getElementById('holdingBody');
  var rows = '';
  var no = 0;
  var years = Object.keys(projectData);
  for (var yi = 0; yi < years.length; yi++) {
    var yr = years[yi];
    var yd = projectData[yr];
    var brands = yd.projects || [];
    for (var bi = 0; bi < brands.length; bi++) {
      var br = brands[bi];
      var containers = Object.keys(br.products || {});
      for (var ci = 0; ci < containers.length; ci++) {
        var cont = containers[ci];
        var prods = br.products[cont];
        for (var pi = 0; pi < prods.length; pi++) {
          var p = prods[pi];
          var gates = p.gates || [];
          for (var gi = 0; gi < gates.length; gi++) {
            var gate = gates[gi];
            if (gate.holdingActive) {
              no++;
              rows += '<tr><td>'+no+'</td>' +
                '<td>'+esc(br.name)+'</td>' +
                '<td>'+(cont==='_direct'?'-':esc(cont))+'</td>' +
                '<td>'+esc(p.name)+'</td>' +
                '<td>'+esc(p.manager||'-')+'</td>' +
                '<td>'+esc(gate.gate||'-')+'</td>' +
                '<td>'+esc(gate.holdingReason||'-')+'</td>' +
                '<td><span style="color:#ff5722;font-weight:600">HOLDING</span></td></tr>';
            }
          }
        }
      }
    }
  }
  body.innerHTML = rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">No holding projects</td></tr>';
}

/* ========== EXPORT ========== */
function exportCSV() { window.location.href = '/api/export'; }

/* ========== STATS ========== */
function loadStats() {
  fetch('/api/stats').then(function(r){return r.json();}).then(function(s){
    document.getElementById('statsBar').innerHTML =
      '<span>DB: '+s.db_size_kb+' KB</span>' +
      '<span>Years: '+s.years+'</span>' +
      '<span>Brands: '+s.brands+'</span>' +
      '<span>Projects: '+s.projects+'</span>' +
      '<span>Gates: '+s.gate_entries+'</span>' +
      '<span>History: '+s.history+'</span>';
  }).catch(function(){});
}
function showStats() {
  fetch('/api/stats').then(function(r){return r.json();}).then(function(s){
    var tbl = '';
    var keys = Object.keys(s);
    for (var i=0;i<keys.length;i++) {
      tbl += '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:600">'+keys[i]+'</td>' +
        '<td style="padding:4px 8px;border-bottom:1px solid #eee">'+s[keys[i]]+'</td></tr>';
    }
    openModal('<h2>Database Statistics</h2>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse">'+tbl+'</table>' +
      '<div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Close</button></div>');
  });
}

/* ========== CLEAR ALL ========== */
function clearAll() {
  if (!confirm('Really clear ALL data? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure?')) return;
  API.clearData().then(function(){
    projectData = {};
    historyRecords = [];
    releasedFiles = {};
    selectedYear = null;
    selectedBrand = null;
    selectedSubFolder = null;
    renderAll();
    toast('All data cleared');
  });
}

/* ========== TABS ========== */
var tabs = document.querySelectorAll('.tab');
for (var i = 0; i < tabs.length; i++) {
  tabs[i].addEventListener('click', function() {
    var allTabs = document.querySelectorAll('.tab');
    var allContents = document.querySelectorAll('.tab-content');
    for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
    for (var j = 0; j < allContents.length; j++) allContents[j].classList.remove('active');
    this.classList.add('active');
    document.getElementById('tab-' + this.getAttribute('data-tab')).classList.add('active');
  });
}

/* ========== MODAL OVERLAY CLICK ========== */
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

/* ========== INIT ========== */
loadAll();
</script>
</body>
</html>"""


# ═══════════════════════════════════════════
# 7. START
# ═══════════════════════════════════════════
if __name__ == '__main__':
    init_db()
    print("=" * 55)
    print("  CODEV ARCHIVE - SQLite + Flask (Verified)")
    print("  DB   : " + DB_PATH)
    print("  Files: " + UPLOAD_DIR)
    print("  URL  : http://localhost:5000")
    print("  Stop : Ctrl+C")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5000, debug=True)
