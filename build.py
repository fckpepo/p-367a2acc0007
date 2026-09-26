#!/usr/bin/env python3
"""NutriTrend Sentinel dashboard builder (stdlib only).

Reads the read-only NutriTrend store and writes data/data.json.
Rerun after every new review/observation:  python3 build.py

Store path: $NUTRITREND_STORE or --store PATH (default /workspace/nutritrend).
The store is never modified.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover - fallback if tzdata is missing
    TZ = dt.timezone(dt.timedelta(hours=-3), "BRT")

HERE = os.path.dirname(os.path.abspath(__file__))
HORIZONS = ["plus_7", "plus_14", "plus_30"]
SCORED = {"HIT", "PARTIAL", "MISS"}
ID_RE = re.compile(r"NT-\d{4}-\d{2}-\d{2}-\d{2}")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_jsonl(path, warnings):
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                warnings.append(f"{os.path.basename(path)}:{n} JSON inválido ({e})")
                continue
            rec["_source_file"] = f"observations/{os.path.basename(path)}"
            rec["_line"] = n
            out.append(rec)
    return out


def rate(h, p, m):
    denom = h + p + m
    if not denom:
        return {"hit_rate": None, "strict_hit_rate": None}
    return {"hit_rate": round((h + 0.5 * p) / denom, 4), "strict_hit_rate": round(h / denom, 4)}


def summarize(trends):
    c = {"HIT": 0, "PARTIAL": 0, "MISS": 0, "ANALYZING": 0}
    for t in trends:
        c[t["status"] if t["status"] in SCORED else "ANALYZING"] += 1
    return {"counts": c, "total": len(trends), **rate(c["HIT"], c["PARTIAL"], c["MISS"])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--store", default=os.environ.get("NUTRITREND_STORE", "/workspace/nutritrend"))
    ap.add_argument("--out", default=os.path.join(HERE, "data", "data.json"))
    args = ap.parse_args()
    store = args.store
    if not os.path.isdir(os.path.join(store, "trends")):
        sys.exit(f"Store não encontrado: {store}")

    now = dt.datetime.now(TZ)
    today = now.date().isoformat()
    warnings = []

    # --- trends -------------------------------------------------------------
    trends = {}
    for path in sorted(glob.glob(os.path.join(store, "trends", "NT-*.json"))):
        rec = load_json(path)
        tid = rec.get("trend_id") or os.path.basename(path)[:-5]
        trends[tid] = {"id": tid, "frozen": rec, "reviews": [], "observations": [], "mentions": []}

    # --- reviews ------------------------------------------------------------
    for path in sorted(glob.glob(os.path.join(store, "reviews", "NT-*.json"))):
        rec = load_json(path)
        rec["_source_file"] = f"reviews/{os.path.basename(path)}"
        tid = rec.get("trend_id")
        if tid not in trends:
            warnings.append(f"Review {rec.get('review_id', path)} referencia trend desconhecida {tid}")
            continue
        trends[tid]["reviews"].append(rec)

    # --- schedules ----------------------------------------------------------
    cohorts = {}
    sched_by_trend = {}
    for path in sorted(glob.glob(os.path.join(store, "reviews", "schedule_cohort_*.json"))):
        s = load_json(path)
        cid = s.get("cohort_id") or os.path.basename(path)[9:-5]
        cohorts[cid] = {k: v for k, v in s.items() if k != "trends"}
        cohorts[cid]["_source_file"] = f"reviews/{os.path.basename(path)}"
        for t in s.get("trends", []):
            sched_by_trend[t.get("trend_id")] = {**t, "cohort_id": cid}

    # --- observations -------------------------------------------------------
    all_obs = []
    for path in sorted(glob.glob(os.path.join(store, "observations", "*.jsonl"))):
        all_obs.extend(load_jsonl(path, warnings))
    general_obs = []
    for o in all_obs:
        tid = o.get("trend_id")
        if tid in trends:
            trends[tid]["observations"].append(o)
        elif tid:
            warnings.append(f"Observação {o['_source_file']}:{o['_line']} referencia trend desconhecida {tid}")
        else:
            general_obs.append(o)
        # cross-references: other trend IDs mentioned in the observation text
        text = json.dumps({k: v for k, v in o.items() if not k.startswith("_")}, ensure_ascii=False)
        for m in sorted(set(ID_RE.findall(text))):
            if m in trends and m != tid:
                trends[m]["mentions"].append({
                    "observation_date": o.get("observation_date") or o.get("date"),
                    "observation_type": o.get("observation_type") or o.get("type"),
                    "from_trend_id": tid,
                    "_source_file": o["_source_file"], "_line": o["_line"],
                })

    # --- derive per-trend status & timeline ---------------------------------
    for tid, t in trends.items():
        fr = t["frozen"]
        t["reviews"].sort(key=lambda r: (r.get("review_date", ""), HORIZONS.index(r["review_horizon"]) if r.get("review_horizon") in HORIZONS else 9))
        t["observations"].sort(key=lambda o: (o.get("observation_date") or o.get("date") or "", o["_line"]))
        t["mentions"].sort(key=lambda o: o.get("observation_date") or "")
        # embedded observation_log in the trend record (if any) is shown too
        t["embedded_observation_log"] = fr.get("observation_log") or []
        sched = sched_by_trend.get(tid)
        t["schedule"] = sched
        t["cohort_id"] = fr.get("cohort_id") or (sched or {}).get("cohort_id")
        latest = t["reviews"][-1] if t["reviews"] else None
        t["latest_result"] = latest.get("result") if latest else None
        t["latest_review_date"] = latest.get("review_date") if latest else None
        t["status"] = t["latest_result"] if t["latest_result"] in SCORED else "ANALYZING"
        due = fr.get("review_dates") or (sched or {}).get("review_dates") or {}
        timeline = []
        for h in HORIZONS:
            revs = [r for r in t["reviews"] if r.get("review_horizon") == h]
            r = revs[-1] if revs else None
            d = due.get(h)
            if r:
                state = "scored"
            elif d and d < today:
                state = "overdue"
            else:
                state = "pending"
            timeline.append({"horizon": h, "due": d, "state": state,
                             "result": r.get("result") if r else None,
                             "review_date": r.get("review_date") if r else None,
                             "review_id": r.get("review_id") if r else None})
        # extra horizons not in the standard set
        for r in t["reviews"]:
            if r.get("review_horizon") not in HORIZONS:
                timeline.append({"horizon": r.get("review_horizon"), "due": None, "state": "scored",
                                 "result": r.get("result"), "review_date": r.get("review_date"),
                                 "review_id": r.get("review_id")})
        t["timeline"] = timeline
        pend = [c["due"] for c in timeline if c["state"] != "scored" and c["due"]]
        t["next_checkpoint"] = min(pend) if pend else None
        if sched and sched.get("last_result") and sched.get("last_result") != t["latest_result"]:
            warnings.append(f"{tid}: schedule.last_result={sched.get('last_result')} difere da última review={t['latest_result']}")

    # --- cohort summaries ---------------------------------------------------
    trend_list = sorted(trends.values(), key=lambda t: t["id"])
    for cid in sorted({t["cohort_id"] for t in trend_list if t["cohort_id"]} | set(cohorts)):
        members = [t for t in trend_list if t["cohort_id"] == cid]
        meta = cohorts.setdefault(cid, {"cohort_id": cid})
        freeze = sorted({t["frozen"].get("prediction_freeze_date") for t in members if t["frozen"].get("prediction_freeze_date")})
        meta["frozen_date"] = meta.get("cohort_date") or (freeze[0] if freeze else None)
        nxt = [t["next_checkpoint"] for t in members if t["next_checkpoint"]]
        meta["next_review_date"] = min(nxt) if nxt else None
        meta["overdue"] = sum(1 for t in members for c in t["timeline"] if c["state"] == "overdue")
        meta["reviews_count"] = sum(len(t["reviews"]) for t in members)
        meta["summary"] = summarize(members)
        meta["trend_ids"] = [t["id"] for t in members]

    data = {
        "generated_at": now.isoformat(timespec="seconds"),
        "generated_tz": "America/Sao_Paulo",
        "build_date": today,
        "store": {"path": store},
        "definitions": {
            "hit_rate": "(HIT + 0.5×PARTIAL) / (HIT + PARTIAL + MISS), usando o veredito mais recente de cada trend",
            "strict_hit_rate": "HIT / (HIT + PARTIAL + MISS)",
            "analyzing": "Último veredito INCONCLUSIVE ou ainda sem review",
        },
        "overall": summarize(trend_list),
        "cohorts": [cohorts[k] for k in sorted(cohorts)],
        "trends": trend_list,
        "general_observations": general_obs,
        "counts": {"trends": len(trend_list), "reviews": sum(len(t["reviews"]) for t in trend_list),
                   "observations": len(all_obs)},
        "warnings": warnings,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, args.out)

    o = data["overall"]
    fmt = lambda x: "—" if x is None else f"{x*100:.1f}%"
    print(f"OK {args.out}  ({data['counts']})")
    print(f"Geral: hit rate {fmt(o['hit_rate'])} · estrito {fmt(o['strict_hit_rate'])} · {o['counts']}")
    for c in data["cohorts"]:
        s = c["summary"]
        print(f"  {c['cohort_id']} congelada {c['frozen_date']}: {s['counts']} hit {fmt(s['hit_rate'])} estrito {fmt(s['strict_hit_rate'])} próxima {c['next_review_date']}")
    for w in warnings:
        print("AVISO:", w)


if __name__ == "__main__":
    main()
