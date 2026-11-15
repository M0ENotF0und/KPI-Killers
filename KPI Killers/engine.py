"""Recommendation + landed-cost engine: validate -> match rules -> price -> rank -> persist."""
from datetime import date
from db import jl

def params(db):
    d = {}
    for r in db.q("SELECT * FROM cost_parameter WHERE effective_date <= ? ORDER BY effective_date, param_id", (date.today().isoformat(),)):
        d[r["type"]] = r
    return d

def landed(aed, p):
    base = aed * p["fx_aed_kes"]["value"]
    duty = base * p["duty"]["value"]
    freight = p["freight"]["value"]
    vat = (base + duty + freight) * p["vat"]["value"]
    return dict(base=round(base, 2), duty=round(duty, 2), freight=round(freight, 2), vat=round(vat, 2), total=round(base + duty + freight + vat, 2))

def models(db, p):
    """Group laptop listings by model; each model has a Local and/or Dubai listing with latest prices."""
    rows = db.q("""SELECT pr.product_id, pr.brand, pr.specs, pr.stock_qty, v.hub, v.name AS vendor, v.purchase_url,
        (SELECT price FROM price_log WHERE product_id=pr.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS price,
        (SELECT currency FROM price_log WHERE product_id=pr.product_id ORDER BY logged_at DESC, price_id DESC LIMIT 1) AS currency
        FROM product pr JOIN vendor v ON v.vendor_id=pr.vendor_id WHERE pr.category='Laptop'""")
    out = {}
    for r in rows:
        if r["price"] is None: continue
        s = jl(r["specs"]); m = out.setdefault(s["model"], dict(name=s["model"], brand=r["brand"], specs=s, local=None, dubai=None))
        if r["hub"] == "Local":
            m["local"] = dict(product_id=r["product_id"], total=r["price"], stock=r["stock_qty"], vendor=r["vendor"], url=r["purchase_url"])
        else:
            aed = r["price"] if r["currency"] == "AED" else r["price"] / p["fx_aed_kes"]["value"]
            m["dubai"] = dict(product_id=r["product_id"], stock=r["stock_qty"], vendor=r["vendor"], url=r["purchase_url"], aed=aed, **landed(aed, p))
    return out

def rule_mins(db, ctx):
    mins = {"min_ram": 0, "min_storage_gb": 0}; hit = []
    for r in db.q("SELECT * FROM rule WHERE is_active = TRUE"):
        cond = jl(r["condition"]); act = jl(r["action"])
        if all(k in ctx and (ctx[k] in v if isinstance(v, list) else ctx[k] == v) for k, v in cond.items()):
            hit.append(r["rule_id"])
            for k in mins: mins[k] = max(mins[k], act.get(k, 0))
    return mins, hit

def recommend(db, ctx, unit_budget, os_pref, storage_gb, hub="Any", qty=1, ergonomics=()):
    p = params(db); mins, _ = rule_mins(db, ctx); res = []
    for m in models(db, p).values():
        s = m["specs"]
        if os_pref not in ("", "No pref.", None) and s["os"] != os_pref: continue
        if s["storage_gb"] < max(storage_gb, mins["min_storage_gb"]) or s["ram_gb"] < mins["min_ram"]: continue
        opts = [(k, m[k]) for k in ("local", "dubai") if m[k] and m[k]["stock"] >= qty and hub in ("Any", k.capitalize())]
        if not opts: continue
        best_k, best = min(opts, key=lambda o: o[1]["total"])
        if best["total"] > unit_budget: continue
        perf = s["ram_gb"] * 2 + s["storage_gb"] / 64 + s["battery_hrs"] * 1.5 + s["cpu_tier"] * 3
        if "Light weight" in ergonomics and s["weight_kg"] <= 1.5: perf += 4
        if "Big screen" in ergonomics and s["screen_in"] >= 15: perf += 4
        if "Long battery" in ergonomics and s["battery_hrs"] >= 12: perf += 4
        res.append(dict(model=m, best_k=best_k, unit=best["total"], score=min(round(perf / (best["total"] / 10000), 2), 999.99)))
    res.sort(key=lambda r: -r["score"])
    return res[:3], p

def save_scenario(db, user_id, budget_total, os_pref, storage_pref, summary, results, params_, qty):
    sid = db.q("INSERT INTO scenario (user_id,budget_cap_kes,brand_os_pref,storage_pref,is_saved) VALUES (?,?,?,?,FALSE) RETURNING scenario_id",
               (user_id, budget_total, os_pref, storage_pref))[0]["scenario_id"]
    db.q("INSERT INTO search_history (user_id,query_summary) VALUES (?,?)", (user_id, summary))
    for rank, r in enumerate(results, 1):
        m = r["model"]
        bid = db.q("INSERT INTO bundle (bundle_type,name,total_price_kes) VALUES (?,?,?) RETURNING bundle_id",
                   ("laptop", m["name"], round(r["unit"] * qty, 2)))[0]["bundle_id"]
        rid = db.q("INSERT INTO recommendation (scenario_id,bundle_id,rank,value_score) VALUES (?,?,?,?) RETURNING rec_id", (sid, bid, rank, r["score"]))[0]["rec_id"]
        for k in ("local", "dubai"):  # both listings stored so landed-cost comparison can be shown
            if not m[k]: continue
            iid = db.q("INSERT INTO bundle_item (bundle_id,product_id,qty) VALUES (?,?,?) RETURNING item_id", (bid, m[k]["product_id"], qty))[0]["item_id"]
            if k == "dubai":
                d = m[k]
                db.q("INSERT INTO landed_cost (rec_id,item_id,param_id,duty,freight,vat,total_kes) VALUES (?,?,?,?,?,?,?)",
                     (rid, iid, params_["duty"]["param_id"], d["duty"], d["freight"], d["vat"], d["total"]))
    return sid
