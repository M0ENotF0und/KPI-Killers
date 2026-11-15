"""IT Recommender - Flask app: front-end (student/business/consumer) + admin panel, both on one DB."""
import os, io, json, csv, secrets, functools
from datetime import datetime, timedelta, timezone
import jwt
from flask import Flask, g, render_template, request, redirect, url_for, flash, make_response, abort, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from db import DB, audit, init_db, jl, BASE
import engine

app = Flask(__name__)
SECRET = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.secret_key = SECRET
ROLES = ("student", "business", "consumer")
COURSES = ["Computer Science", "Engineering", "Business", "Medicine", "Arts & Design", "Education"]
SERVICES = ["Software / Dev", "Design studio", "Office / Admin", "Retail / Sales"]
NEEDS = ["Browsing & streaming", "Office & study", "Gaming", "Video editing"]
RANGES = {"Under KES 60,000": 60000, "KES 60,000 - 100,000": 100000, "KES 100,000 - 150,000": 150000, "Above KES 150,000": 10**7}
STORAGE = {"256 GB": 256, "512 GB": 512, "1 TB+": 1024}

# ---------- request lifecycle / auth ----------
@app.before_request
def load():
    g.db = DB(); g.user = None
    tok = request.cookies.get("token")
    if tok:
        try:
            c = jwt.decode(tok, SECRET, algorithms=["HS256"])
            g.user = g.db.q('SELECT * FROM "user" WHERE user_id=?', (c["uid"],), one=True); g.csrf = c["csrf"]
        except jwt.PyJWTError: pass
    if request.method == "POST" and g.user and request.form.get("csrf") != g.csrf:
        abort(400, "Invalid form token. Reload the page and try again.")

@app.after_request
def finish(resp):
    if getattr(g, "db", None):
        (g.db.commit if resp.status_code < 400 else g.db.rollback)()
    return resp

@app.teardown_request
def close(_):
    if getattr(g, "db", None): g.db.close()

@app.context_processor
def inject():
    return dict(me=g.user, csrf=getattr(g, "csrf", ""), jl=jl)

@app.template_filter("dt")
def dt(v): return str(v)[:16]
@app.template_filter("kes")
def kes(v): return f"{v:,.0f}"

def login_required(f):
    @functools.wraps(f)
    def w(*a, **k):
        if not g.user: return redirect(url_for("login"))
        return f(*a, **k)
    return w

def role_required(*roles):
    def deco(f):
        @functools.wraps(f)
        @login_required
        def w(*a, **k):
            if g.user["role"] not in roles: abort(403)
            return f(*a, **k)
        return w
    return deco

@app.errorhandler(400)
@app.errorhandler(403)
@app.errorhandler(404)
def err(e): return render_template("error.html", e=e), e.code

def home_for(u): return url_for("admin_home") if u["role"] == "admin" else url_for("scenario")

@app.route("/")
def index(): return redirect(home_for(g.user)) if g.user else redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = g.db.q('SELECT * FROM "user" WHERE email=?', (request.form["email"].strip().lower(),), one=True)
        if u and check_password_hash(u["password_hash"], request.form["password"]):
            tok = jwt.encode({"uid": u["user_id"], "csrf": secrets.token_hex(16), "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, SECRET, algorithm="HS256")
            audit(g.db, u["user_id"], "login")
            r = make_response(redirect(home_for(u))); r.set_cookie("token", tok, httponly=True, samesite="Lax"); return r
        audit(g.db, None, "failed login: " + request.form["email"][:40]); flash("Invalid email or password.", "error")
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        f = request.form; email = f["email"].strip().lower(); errs = []
        if not f["full_name"].strip(): errs.append("Full name is required.")
        if "@" not in email or "." not in email: errs.append("Enter a valid email.")
        if len(f["password"]) < 8: errs.append("Password must be at least 8 characters.")
        if f["password"] != f["confirm"]: errs.append("Passwords do not match.")
        if f["role"] not in ROLES: errs.append("Choose an account type.")
        if not errs and g.db.q('SELECT 1 FROM "user" WHERE email=?', (email,)): errs.append("That email is already registered.")
        if errs:
            for e in errs: flash(e, "error")
        else:
            uid = new_user(f["full_name"].strip(), email, f["password"], f["role"]); audit(g.db, uid, "registered")
            flash("Account created. Please log in.", "ok"); return redirect(url_for("login"))
    return render_template("register.html", roles=ROLES)

def new_user(name, email, pw, role):
    uid = g.db.q('INSERT INTO "user" (full_name,email,password_hash,role) VALUES (?,?,?,?) RETURNING user_id', (name, email, generate_password_hash(pw), role))[0]["user_id"]
    tbl = {"student": "student_profile", "business": "business_profile", "consumer": "consumer_profile"}.get(role)
    if tbl: g.db.q(f"INSERT INTO {tbl} (user_id) VALUES (?)", (uid,))
    return uid

@app.route("/logout", methods=["POST"])
@login_required
def logout():
    audit(g.db, g.user["user_id"], "logout"); r = make_response(redirect(url_for("login"))); r.delete_cookie("token"); return r

# ---------- front-end: scenario -> results ----------
@app.route("/scenario", methods=["GET", "POST"])
@role_required("student", "business", "consumer")
def scenario():
    role = g.user["role"]; uid = g.user["user_id"]
    if request.method == "GET":
        prof = g.db.q(f"SELECT * FROM {role}_profile WHERE user_id=?", (uid,), one=True) or {}
        return render_template("scenario.html", role=role, prof=prof, courses=COURSES, services=SERVICES, needs=NEEDS, ranges=RANGES, storage=STORAGE)
    f = request.form; errs = []; os_pref = f.get("os", "No pref."); st = f.get("storage", "256 GB"); erg = f.getlist("erg")
    try: budget = float(f.get("budget", ""))
    except ValueError: budget = -1
    ctx = {"role": role}; qty = 1; hub = "Any"
    if role == "student":
        if not f.get("course"): errs.append("Select your course.")
        if f.get("workload") not in ("Light", "Moderate", "Heavy"): errs.append("Select a workload.")
        ctx.update(course=f.get("course"), workload=f.get("workload")); unit = budget
        summary = f"Student | {f.get('course')} | {f.get('workload')} | budget {budget:,.0f}"
    elif role == "business":
        try: team = int(f.get("team_size", "")); assert team > 0
        except (ValueError, AssertionError): team = 0; errs.append("Team size must be a positive number.")
        if f.get("service") not in SERVICES: errs.append("Select a service model.")
        hub = f.get("hub", "Any"); ctx.update(service_model=f.get("service")); qty = max(team, 1); unit = budget / qty
        summary = f"Business | {f.get('service')} | {team} seats | dept budget {budget:,.0f} | hub {hub}"
    else:
        if f.get("needs") not in NEEDS: errs.append("Select your daily needs.")
        if f.get("range") not in RANGES: errs.append("Select a price range.")
        budget = RANGES.get(f.get("range"), -1); unit = budget; ctx.update(daily_needs=f.get("needs"))
        if f.get("form") == "Lightweight": erg.append("Light weight")
        if f.get("form") == "Large screen": erg.append("Big screen")
        summary = f"Consumer | {f.get('needs')} | {f.get('range')} | {f.get('form')}"
    if budget < 0 and role != "consumer": errs.append("Budget must be a number and at least 0.")
    if errs:
        for e in errs: flash(e, "error")
        return redirect(url_for("scenario"))
    res, p = engine.recommend(g.db, ctx, unit, os_pref, STORAGE.get(st, 256), hub, qty, erg)
    sid = engine.save_scenario(g.db, uid, budget, os_pref, st, summary, res, p, qty)
    if role == "student": g.db.q("UPDATE student_profile SET course=?, est_workload=? WHERE user_id=?", (f["course"], f["workload"], uid))
    elif role == "business": g.db.q("UPDATE business_profile SET service_model=?, team_size=?, dept_budget_kes=?, sourcing_hub=? WHERE user_id=?", (f["service"], qty, budget, hub, uid))
    else: g.db.q("UPDATE consumer_profile SET daily_needs=?, price_range=?, form_factor=? WHERE user_id=?", (f["needs"], f["range"], f.get("form"), uid))
    audit(g.db, uid, f"scenario #{sid} created")
    return redirect(url_for("results", sid=sid))

def load_results(sid):
    sc = g.db.q("SELECT * FROM scenario WHERE scenario_id=?", (sid,), one=True)
    if not sc or (sc["user_id"] != g.user["user_id"] and g.user["role"] != "admin"): abort(404)
    p = engine.params(g.db); allm = engine.models(g.db, p)
    recs = g.db.q("""SELECT r.rec_id, r.rank, r.value_score, b.name, b.total_price_kes, (SELECT MAX(qty) FROM bundle_item WHERE bundle_id=b.bundle_id) AS qty
                     FROM recommendation r JOIN bundle b ON b.bundle_id=r.bundle_id WHERE r.scenario_id=? ORDER BY r.rank""", (sid,))
    for r in recs: r["m"] = allm.get(r["name"])
    return sc, recs

@app.route("/results/<int:sid>")
@role_required("student", "business", "consumer")
def results(sid):
    sc, recs = load_results(sid)
    saved = {r["product_id"] for r in g.db.q("SELECT product_id FROM saved_item WHERE user_id=?", (g.user["user_id"],))}
    vals = [v["total"] for r in recs if r["m"] for v in (r["m"]["local"], r["m"]["dubai"]) if v]
    return render_template("results.html", sc=sc, recs=recs, saved=saved, mx=max(vals or [1]))

@app.route("/results/<int:sid>/pdf")
@role_required("student", "business", "consumer")
def results_pdf(sid):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    sc, recs = load_results(sid); buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=A4); y = 800
    c.setFont("Helvetica-Bold", 16); c.drawString(50, y, "IT Recommender - Recommendation report"); y -= 22
    c.setFont("Helvetica", 9); c.drawString(50, y, f"{g.user['full_name']} | {datetime.now():%d %b %Y} | Budget KES {sc['budget_cap_kes']:,.0f}"); y -= 30
    for r in recs:
        m = r["m"]; c.setFont("Helvetica-Bold", 12); c.drawString(50, y, f"#{r['rank']}  {r['name']}   (value score {r['value_score']})"); y -= 16; c.setFont("Helvetica", 10)
        if m:
            s = m["specs"]; c.drawString(60, y, f"{s['os']} | {s['ram_gb']}GB RAM | {s['storage_gb']}GB | {s['battery_hrs']}h battery | {s['weight_kg']}kg"); y -= 14
            if m["local"]: c.drawString(60, y, f"Local ({m['local']['vendor']}): KES {m['local']['total']:,.0f}"); y -= 14
            if m["dubai"]:
                d = m["dubai"]; c.drawString(60, y, f"Dubai landed: KES {d['total']:,.0f}  (price {d['base']:,.0f} + duty {d['duty']:,.0f} + freight {d['freight']:,.0f} + VAT {d['vat']:,.0f})"); y -= 14
        y -= 14
    c.setFont("Helvetica-Oblique", 8); c.drawString(50, 40, "Landed-cost rates are estimates; verify before purchase."); c.save(); buf.seek(0)
    audit(g.db, g.user["user_id"], f"exported PDF #{sid}")
    return send_file(buf, mimetype="application/pdf", download_name=f"recommendation_{sid}.pdf")

@app.route("/scenarios")
@role_required("student", "business", "consumer")
def scenarios():
    rows = g.db.q("""SELECT s.*, (SELECT COUNT(*) FROM recommendation r WHERE r.scenario_id=s.scenario_id) AS n
                     FROM scenario s WHERE s.user_id=? ORDER BY scenario_id DESC""", (g.user["user_id"],))
    return render_template("scenarios.html", rows=rows)

@app.route("/scenarios/<int:sid>/<action>", methods=["POST"])
@role_required("student", "business", "consumer")
def scenario_action(sid, action):
    sc = g.db.q("SELECT * FROM scenario WHERE scenario_id=? AND user_id=?", (sid, g.user["user_id"]), one=True) or abort(404)
    if action == "save": g.db.q("UPDATE scenario SET is_saved=? WHERE scenario_id=?", (not sc["is_saved"], sid)); audit(g.db, g.user["user_id"], f"scenario #{sid} save toggled")
    elif action == "delete": g.db.q("DELETE FROM scenario WHERE scenario_id=?", (sid,)); audit(g.db, g.user["user_id"], f"scenario #{sid} deleted"); return redirect(url_for("scenarios"))
    return redirect(request.referrer or url_for("scenarios"))

@app.route("/wishlist")
@role_required("student", "business", "consumer")
def wishlist():
    rows = g.db.q("""SELECT si.saved_id, si.kind, p.product_id, p.brand, p.specs, v.name AS vendor, v.hub, v.purchase_url,
        (SELECT price FROM price_log WHERE product_id=p.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS price,
        (SELECT currency FROM price_log WHERE product_id=p.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS currency
        FROM saved_item si JOIN product p ON p.product_id=si.product_id JOIN vendor v ON v.vendor_id=p.vendor_id WHERE si.user_id=?""", (g.user["user_id"],))
    return render_template("wishlist.html", rows=rows)

@app.route("/wishlist/add", methods=["POST"])
@role_required("student", "business", "consumer")
def wishlist_add():
    pid = int(request.form["product_id"])
    if not g.db.q("SELECT 1 FROM saved_item WHERE user_id=? AND product_id=?", (g.user["user_id"], pid)):
        g.db.q("INSERT INTO saved_item (user_id,product_id,kind) VALUES (?,?,'wishlist')", (g.user["user_id"], pid)); audit(g.db, g.user["user_id"], f"wishlist add p{pid}")
    flash("Saved to wishlist.", "ok"); return redirect(request.referrer or url_for("wishlist"))

@app.route("/wishlist/<int:sid>/delete", methods=["POST"])
@role_required("student", "business", "consumer")
def wishlist_del(sid):
    g.db.q("DELETE FROM saved_item WHERE saved_id=? AND user_id=?", (sid, g.user["user_id"])); return redirect(url_for("wishlist"))

# ---------- admin panel ----------
@app.route("/admin")
@role_required("admin")
def admin_home():
    n = lambda sql: g.db.q(sql, one=True)["n"]
    bk = sorted(os.listdir(os.path.join(BASE, "backups")))
    stats = dict(items=n("SELECT COUNT(*) n FROM product"), users=n('SELECT COUNT(*) n FROM "user"'), scenarios=n("SELECT COUNT(*) n FROM scenario"),
                 alerts=n("SELECT COUNT(*) n FROM product WHERE stock_qty < 5"), backup=bk[-1] if bk else "never")
    return render_template("admin/home.html", s=stats, recent=g.db.q('SELECT a.*, u.full_name FROM audit_log a LEFT JOIN "user" u ON u.user_id=a.user_id ORDER BY log_id DESC LIMIT 8'))

PROD_SQL = """SELECT p.*, v.name AS vendor, v.hub,
  (SELECT price FROM price_log WHERE product_id=p.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS price,
  (SELECT currency FROM price_log WHERE product_id=p.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS currency
  FROM product p JOIN vendor v ON v.vendor_id=p.vendor_id"""

@app.route("/admin/catalog")
@role_required("admin")
def admin_catalog():
    s = request.args.get("q", "").strip(); like = f"%{s}%"
    rows = g.db.q(PROD_SQL + " WHERE p.brand LIKE ? OR p.category LIKE ? OR CAST(p.specs AS TEXT) LIKE ? OR v.name LIKE ? ORDER BY p.product_id", (like,) * 4) if s else g.db.q(PROD_SQL + " ORDER BY p.product_id")
    return render_template("admin/catalog.html", rows=rows, q=s)

@app.route("/admin/catalog/new", methods=["GET", "POST"])
@app.route("/admin/catalog/<int:pid>/edit", methods=["GET", "POST"])
@role_required("admin")
def admin_product(pid=None):
    vendors = g.db.q("SELECT * FROM vendor ORDER BY name"); cur = g.db.q(PROD_SQL + " WHERE p.product_id=?", (pid,), one=True) if pid else None
    if pid and not cur: abort(404)
    if request.method == "POST":
        f = request.form
        try:
            price = float(f["price"]); stock = int(f["stock"]); assert price >= 0 and stock >= 0
            specs = {"model": f["model"].strip()}
            for k in ("os",): specs[k] = f[k]
            for k in ("ram_gb", "storage_gb", "battery_hrs", "cpu_tier"): specs[k] = int(f[k] or 0)
            for k in ("weight_kg", "screen_in"): specs[k] = float(f[k] or 0)
            assert specs["model"]
        except (ValueError, AssertionError, KeyError):
            flash("Check the form: model required; price, stock and specs must be valid non-negative numbers.", "error")
            return render_template("admin/product_form.html", p=cur, vendors=vendors, f=f)
        v = g.db.q("SELECT hub FROM vendor WHERE vendor_id=?", (f["vendor_id"],), one=True); curr = "KES" if v["hub"] == "Local" else "AED"
        if pid:
            g.db.q("UPDATE product SET vendor_id=?,category=?,brand=?,specs=?,stock_qty=? WHERE product_id=?", (f["vendor_id"], f["category"], f["brand"], json.dumps(specs), stock, pid))
            if cur["price"] != price or cur["currency"] != curr: g.db.q("INSERT INTO price_log (product_id,price,currency) VALUES (?,?,?)", (pid, price, curr))
            audit(g.db, g.user["user_id"], f"product #{pid} edited")
        else:
            pid = g.db.q("INSERT INTO product (vendor_id,category,brand,specs,stock_qty) VALUES (?,?,?,?,?) RETURNING product_id", (f["vendor_id"], f["category"], f["brand"], json.dumps(specs), stock))[0]["product_id"]
            g.db.q("INSERT INTO price_log (product_id,price,currency) VALUES (?,?,?)", (pid, price, curr)); audit(g.db, g.user["user_id"], f"product #{pid} added")
        flash("Product saved.", "ok"); return redirect(url_for("admin_catalog"))
    return render_template("admin/product_form.html", p=cur, vendors=vendors, f=None)

@app.route("/admin/catalog/<int:pid>/delete", methods=["POST"])
@role_required("admin")
def admin_product_del(pid):
    g.db.q("DELETE FROM product WHERE product_id=?", (pid,)); audit(g.db, g.user["user_id"], f"product #{pid} deleted"); flash("Product deleted.", "ok"); return redirect(url_for("admin_catalog"))

@app.route("/admin/catalog/import", methods=["POST"])
@role_required("admin")
def admin_import():
    """CSV columns: vendor_id,category,brand,model,os,ram_gb,storage_gb,battery_hrs,weight_kg,screen_in,cpu_tier,price,stock"""
    fl = request.files.get("file"); ok = bad = 0
    if not fl: flash("Choose a CSV file.", "error"); return redirect(url_for("admin_catalog"))
    for row in csv.DictReader(io.StringIO(fl.read().decode("utf-8-sig"))):
        try:
            v = g.db.q("SELECT hub FROM vendor WHERE vendor_id=?", (int(row["vendor_id"]),), one=True); assert v
            specs = dict(model=row["model"], os=row["os"], ram_gb=int(row["ram_gb"]), storage_gb=int(row["storage_gb"]), battery_hrs=int(row["battery_hrs"]), weight_kg=float(row["weight_kg"]), screen_in=float(row["screen_in"]), cpu_tier=int(row["cpu_tier"]))
            pid = g.db.q("INSERT INTO product (vendor_id,category,brand,specs,stock_qty) VALUES (?,?,?,?,?) RETURNING product_id", (int(row["vendor_id"]), row["category"], row["brand"], json.dumps(specs), int(row["stock"])))[0]["product_id"]
            g.db.q("INSERT INTO price_log (product_id,price,currency) VALUES (?,?,?)", (pid, float(row["price"]), "KES" if v["hub"] == "Local" else "AED")); ok += 1
        except Exception: bad += 1
    audit(g.db, g.user["user_id"], f"CSV import {ok} ok/{bad} bad"); flash(f"Imported {ok} row(s); {bad} skipped.", "ok" if ok else "error"); return redirect(url_for("admin_catalog"))

@app.route("/admin/rates", methods=["GET", "POST"])
@role_required("admin")
def admin_rates():
    if request.method == "POST":
        try: val = float(request.form["value"]); assert val >= 0
        except (ValueError, AssertionError): flash("Rate must be a non-negative number.", "error"); return redirect(url_for("admin_rates"))
        g.db.q("INSERT INTO cost_parameter (type,value,effective_date) VALUES (?,?,?)", (request.form["type"], val, request.form["effective"] or datetime.now().date().isoformat()))
        audit(g.db, g.user["user_id"], f"rate {request.form['type']} set {val}"); flash("Rate saved.", "ok"); return redirect(url_for("admin_rates"))
    return render_template("admin/rates.html", rows=g.db.q("SELECT * FROM cost_parameter ORDER BY effective_date DESC, param_id DESC"), cur=engine.params(g.db))

@app.route("/admin/rules", methods=["GET", "POST"])
@role_required("admin")
def admin_rules():
    if request.method == "POST":
        f = request.form; act = f["action"]; rid = f.get("rule_id")
        if act == "toggle": g.db.q("UPDATE rule SET is_active = NOT is_active WHERE rule_id=?", (rid,))
        elif act == "delete": g.db.q("DELETE FROM rule WHERE rule_id=?", (rid,))
        else:
            try: c = json.loads(f["condition"]); a = json.loads(f["act"]); assert isinstance(c, dict) and isinstance(a, dict)
            except Exception: flash("Condition and action must be valid JSON objects.", "error"); return redirect(url_for("admin_rules"))
            g.db.q("INSERT INTO rule (rule_type,condition,action,is_active) VALUES (?,?,?,TRUE)", (f["rule_type"][:40], json.dumps(c), json.dumps(a)))
        audit(g.db, g.user["user_id"], f"rule {act}"); return redirect(url_for("admin_rules"))
    return render_template("admin/rules.html", rows=g.db.q("SELECT * FROM rule ORDER BY rule_id"))

@app.route("/admin/users", methods=["GET", "POST"])
@role_required("admin")
def admin_users():
    if request.method == "POST":
        f = request.form; act = f["action"]
        if act == "create":
            email = f["email"].strip().lower()
            if len(f["password"]) < 8 or "@" not in email or f["role"] not in ROLES + ("admin",) or g.db.q('SELECT 1 FROM "user" WHERE email=?', (email,)):
                flash("Invalid details, weak password (min 8) or email already used.", "error")
            else: new_user(f["full_name"].strip() or email, email, f["password"], f["role"]); audit(g.db, g.user["user_id"], f"user created {email}"[:60]); flash("User created.", "ok")
        elif act == "reset":
            if len(f["password"]) < 8: flash("Password must be at least 8 characters.", "error")
            else: g.db.q('UPDATE "user" SET password_hash=? WHERE user_id=?', (generate_password_hash(f["password"]), f["user_id"])); audit(g.db, g.user["user_id"], f"password reset u{f['user_id']}"); flash("Password reset.", "ok")
        elif act == "delete":
            if int(f["user_id"]) == g.user["user_id"]: flash("You cannot delete yourself.", "error")
            else: g.db.q('DELETE FROM "user" WHERE user_id=?', (f["user_id"],)); audit(g.db, g.user["user_id"], f"user deleted u{f['user_id']}"); flash("User deleted.", "ok")
        return redirect(url_for("admin_users"))
    return render_template("admin/users.html", rows=g.db.q('SELECT * FROM "user" ORDER BY user_id'), roles=ROLES + ("admin",))

@app.route("/admin/audit")
@role_required("admin")
def admin_audit():
    return render_template("admin/audit.html", rows=g.db.q('SELECT a.*, u.full_name FROM audit_log a LEFT JOIN "user" u ON u.user_id=a.user_id ORDER BY log_id DESC LIMIT 300'))

TABLES = ["user", "student_profile", "business_profile", "consumer_profile", "vendor", "product", "price_log", "cost_parameter", "rule", "scenario", "bundle", "bundle_item", "recommendation", "landed_cost", "saved_item", "search_history", "audit_log"]
@app.route("/admin/backup", methods=["GET", "POST"])
@role_required("admin")
def admin_backup():
    d = os.path.join(BASE, "backups")
    if request.method == "POST":
        data = {t: g.db.q(f'SELECT * FROM "{t}"') for t in TABLES}
        for r in data["user"]: r.pop("password_hash", None)
        name = f"backup_{datetime.now():%Y%m%d_%H%M%S}.json"; json.dump(data, open(os.path.join(d, name), "w"), default=str, indent=1)
        audit(g.db, g.user["user_id"], "backup created"); flash(f"Backup {name} created.", "ok"); return redirect(url_for("admin_backup"))
    if request.args.get("file"): return send_file(os.path.join(d, os.path.basename(request.args["file"])), as_attachment=True)
    return render_template("admin/backup.html", files=sorted(os.listdir(d), reverse=True))

# ---------- forgot / reset password (signed, expiring, single-use token; no mail server needed for the prototype) ----------
def reset_token(u):
    return jwt.encode({"uid": u["user_id"], "fp": u["password_hash"][-12:], "exp": datetime.now(timezone.utc) + timedelta(minutes=30)}, SECRET, algorithm="HS256")

@app.route("/forgot", methods=["GET", "POST"])
def forgot():
    link = None
    if request.method == "POST":
        u = g.db.q('SELECT * FROM "user" WHERE email=?', (request.form["email"].strip().lower(),), one=True)
        if u:
            link = url_for("reset", token=reset_token(u), _external=True); audit(g.db, u["user_id"], "password reset requested")
        else: flash("No account with that email.", "error")
    return render_template("forgot.html", link=link)

@app.route("/reset/<token>", methods=["GET", "POST"])
def reset(token):
    try:
        c = jwt.decode(token, SECRET, algorithms=["HS256"]); u = g.db.q('SELECT * FROM "user" WHERE user_id=?', (c["uid"],), one=True)
        assert u and u["password_hash"][-12:] == c["fp"]
    except Exception:
        flash("This reset link is invalid, expired or already used.", "error"); return redirect(url_for("forgot"))
    if request.method == "POST":
        if len(request.form["password"]) < 8 or request.form["password"] != request.form["confirm"]:
            flash("Passwords must match and be at least 8 characters.", "error")
        else:
            g.db.q('UPDATE "user" SET password_hash=? WHERE user_id=?', (generate_password_hash(request.form["password"]), u["user_id"]))
            audit(g.db, u["user_id"], "password reset done"); flash("Password changed. Please log in.", "ok"); return redirect(url_for("login"))
    return render_template("reset.html")

@app.route("/help")
def help_page(): return render_template("help.html")

# ---------- admin report (filter / sort / print) ----------
@app.route("/admin/report")
@role_required("admin")
def admin_report():
    cat = request.args.get("category", ""); hub = request.args.get("hub", ""); sort = request.args.get("sort", "price")
    rows = g.db.q(PROD_SQL + " ORDER BY p.product_id"); p = engine.params(g.db)
    for r in rows:
        r["model"] = jl(r["specs"]).get("model", ""); r["kes"] = r["price"] if r["currency"] == "KES" else engine.landed(r["price"], p)["total"]
    rows = [r for r in rows if (not cat or r["category"] == cat) and (not hub or r["hub"] == hub)]
    rows.sort(key=lambda r: {"price": r["kes"], "stock": r["stock_qty"], "model": r["model"].lower()}.get(sort, r["kes"]))
    audit(g.db, g.user["user_id"], "report viewed")
    return render_template("admin/report.html", rows=rows, cat=cat, hub=hub, sort=sort, now=datetime.now(), total=sum(r["kes"] * r["stock_qty"] for r in rows))

init_db()  # creates tables + seed data on first run
if __name__ == "__main__":
    app.run(debug=True, port=5000)
