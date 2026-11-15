"""Database layer. PostgreSQL when DATABASE_URL=postgresql://..., otherwise a local SQLite file
(so the project can be demoed with zero setup). All queries are parameterised (no SQL injection)."""
import os, re, json, sqlite3
from decimal import Decimal
from datetime import date
from werkzeug.security import generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get("DATABASE_URL", "")
IS_PG = URL.startswith("postgres")
SQLITE_PATH = os.path.join(BASE, "it_recommender.db")

def jl(v):
    """JSON column -> python (psycopg2 returns dict, sqlite returns str)."""
    return v if isinstance(v, (dict, list)) or v is None else json.loads(v)

class DB:
    def __init__(self):
        if IS_PG:
            import psycopg2, psycopg2.extras
            self.conn = psycopg2.connect(URL, cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            self.conn = sqlite3.connect(SQLITE_PATH)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA foreign_keys=ON")

    def q(self, sql, args=(), one=False):
        if IS_PG: sql = sql.replace("?", "%s")
        cur = self.conn.cursor(); cur.execute(sql, args)
        rows = []
        if cur.description:
            for r in cur.fetchall():
                rows.append({k: (float(v) if isinstance(v, Decimal) else v) for k, v in dict(r).items()})
        return (rows[0] if rows else None) if one else rows

    def commit(self): self.conn.commit()
    def rollback(self): self.conn.rollback()
    def close(self): self.conn.close()

def audit(db, user_id, action):
    db.q("INSERT INTO audit_log (user_id, action) VALUES (?, ?)", (user_id, action[:60]))

def init_db():
    sql = open(os.path.join(BASE, "schema.sql")).read()
    if not IS_PG:
        sql = re.sub(r"\b(BIG)?SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT", sql)
        sql = sql.replace("JSONB", "TEXT")
    db = DB()
    if IS_PG: db.conn.cursor().execute(sql)
    else: db.conn.executescript(sql)
    db.commit()
    if not db.q("SELECT 1 FROM \"user\" LIMIT 1"): seed(db)
    db.close()

LAPTOPS = [  # model, brand, os, ram, storage_gb, battery_h, weight_kg, screen_in, cpu_tier, KES, AED
 ("Lenovo IdeaPad Slim 3", "Lenovo", "Windows", 8, 256, 8, 1.6, 15.6, 2, 52000, 1350),
 ("HP 250 G9", "HP", "Windows", 8, 512, 7, 1.7, 15.6, 2, 58000, 1500),
 ("Acer Aspire 5", "Acer", "Windows", 8, 512, 9, 1.7, 15.6, 2, 60000, 1550),
 ("ASUS Vivobook 15", "ASUS", "Windows", 8, 512, 8, 1.7, 15.6, 3, 62000, 1600),
 ("Dell Inspiron 15", "Dell", "Windows", 16, 512, 9, 1.8, 15.6, 3, 85000, 2200),
 ("MacBook Air M1", "Apple", "macOS", 8, 256, 15, 1.3, 13.3, 4, 98000, 2700),
 ("Lenovo ThinkPad E14", "Lenovo", "Windows", 16, 512, 10, 1.6, 14, 3, 105000, 2750),
 ("ASUS TUF Gaming F15", "ASUS", "Windows", 16, 1024, 6, 2.3, 15.6, 5, 135000, 3500),
 ("MacBook Air M2", "Apple", "macOS", 16, 512, 18, 1.2, 13.6, 5, 165000, 4500),
 ("Dell XPS 13 Developer Ed.", "Dell", "Linux", 16, 512, 12, 1.2, 13.4, 5, 190000, 5000),
]
def seed(db):
    pw = generate_password_hash("Admin123!")
    db.q("INSERT INTO \"user\" (full_name,email,password_hash,role) VALUES (?,?,?,?)", ("System Admin", "admin@recommend.app", pw, "admin"))
    for n, e, r in [("Demo Student", "student@recommend.app", "student"), ("Demo Business", "business@recommend.app", "business"), ("Demo Consumer", "consumer@recommend.app", "consumer")]:
        db.q("INSERT INTO \"user\" (full_name,email,password_hash,role) VALUES (?,?,?,?)", (n, e, generate_password_hash("Demo1234!"), r))
    vend = {}
    for name, hub, url in [("Nairobi Tech Hub", "Local", "https://example.co.ke"), ("Compu Kenya", "Local", "https://example.co.ke/compu"),
                           ("Deira Electronics LLC", "Dubai", "https://example.ae"), ("Al Barsha Digital", "Dubai", "https://example.ae/barsha")]:
        vend.setdefault(hub, []).append(db.q("INSERT INTO vendor (name,hub,purchase_url) VALUES (?,?,?) RETURNING vendor_id", (name, hub, url))[0]["vendor_id"])
    for i, (m, b, os_, ram, st, bat, wt, sc, cpu, kes, aed) in enumerate(LAPTOPS):
        specs = json.dumps(dict(model=m, os=os_, ram_gb=ram, storage_gb=st, battery_hrs=bat, weight_kg=wt, screen_in=sc, cpu_tier=cpu))
        for hub, price, cur, mult in (("Local", kes, "KES", 1.0), ("Dubai", round(aed * 0.88), "AED", 1.0)):
            pid = db.q("INSERT INTO product (vendor_id,category,brand,specs,stock_qty) VALUES (?,?,?,?,?) RETURNING product_id",
                       (vend[hub][i % 2], "Laptop", b, specs, 3 + (i * 7) % 20))[0]["product_id"]
            db.q("INSERT INTO price_log (product_id,price,currency) VALUES (?,?,?)", (pid, round(price * 1.04, 2), cur))  # older price
            db.q("INSERT INTO price_log (product_id,price,currency,logged_at) VALUES (?,?,?,datetime('now','+1 second'))" if not IS_PG else
                 "INSERT INTO price_log (product_id,price,currency,logged_at) VALUES (?,?,?,now() + interval '1 second')", (pid, price, cur))
    for a, b, ac in [("Logitech M185 Mouse", "Logitech", 1200), ("Laptop Backpack 15.6\"", "Generic", 2500)]:
        pid = db.q("INSERT INTO product (vendor_id,category,brand,specs,stock_qty) VALUES (?,?,?,?,?) RETURNING product_id",
                   (vend["Local"][0], "Accessory", b, json.dumps(dict(model=a)), 40))[0]["product_id"]
        db.q("INSERT INTO price_log (product_id,price,currency) VALUES (?,?,?)", (pid, ac, "KES"))
    today = date.today().isoformat()
    # Starting rates; the admin maintains them under Prices & rates.
    for t, v in [("fx_aed_kes", 35.2), ("duty", 0.045), ("vat", 0.16), ("freight", 3500)]:
        db.q("INSERT INTO cost_parameter (type,value,effective_date) VALUES (?,?,?)", (t, v, today))
    R = [("workload", {"workload": "Heavy"}, {"min_ram": 16, "min_storage_gb": 512}),
         ("course", {"course": ["Computer Science", "Engineering", "Arts & Design"]}, {"min_ram": 16}),
         ("needs", {"daily_needs": ["Gaming", "Video editing"]}, {"min_ram": 16, "min_storage_gb": 512}),
         ("service", {"service_model": ["Software / Dev", "Design studio"]}, {"min_ram": 16}),
         ("service", {"service_model": "Office / Admin"}, {"min_ram": 8})]
    for t, c, a in R:
        db.q("INSERT INTO rule (rule_type,condition,action,is_active) VALUES (?,?,?,TRUE)", (t, json.dumps(c), json.dumps(a)))
    audit(db, None, "database seeded"); db.commit()

if __name__ == "__main__":
    init_db(); print("Database ready:", "PostgreSQL" if IS_PG else SQLITE_PATH)
