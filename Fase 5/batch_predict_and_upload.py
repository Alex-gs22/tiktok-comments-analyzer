#!/usr/bin/env python3
"""
batch_predict_and_upload.py
═══════════════════════════════════════════════════════════
Fase 5 — Batch prediction + upload to Supabase.

1. Loads the 10,874 unlabeled comments from Fase 3/data/corpus_sin_etiquetar.csv
2. Runs inference locally with the best model (v3_pseudo)
3. Uploads results to Supabase tables:
   - temas_produccion  (15 topics)
   - videos_analizados (34 videos)
   - predicciones      (~10,874 rows)
   - sesiones_analisis (1 session record)

Usage:
  pip install supabase
  python3 batch_predict_and_upload.py [--batch-size 64] [--dry-run]

Environment:
  SUPABASE_URL  — your Supabase project URL
  SUPABASE_KEY  — your service_role key (NOT anon — needs insert access)
═══════════════════════════════════════════════════════════
"""

import os
import sys
import csv
import json
import time
import argparse
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ── Paths ────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent  # tiktok-comments-analyzer/
MODEL_DIR = ROOT / "Fase 3" / "runs" / "robertuito_emociones_v3_pseudo" / "best_model"
DATA_CSV  = ROOT / "Fase 3" / "data" / "corpus_sin_etiquetar.csv"
LABEL_MAP = ROOT / "Fase 3" / "runs" / "robertuito_emociones_v3_pseudo" / "label_mapping.json"
ENV_FILE  = ROOT / "Fase 5" / "analizadoremociones-main" / ".env.local"

UNCERTAINTY_THRESHOLD = 0.40

# ── Load label mapping ───────────────────────────────────

def load_label_mapping():
    with open(LABEL_MAP) as f:
        mapping = json.load(f)
    return {int(k): v for k, v in mapping["id2label"].items()}


# ── Load model ───────────────────────────────────────────

def load_model(device):
    print(f"[1/5] Loading model from {MODEL_DIR.name}...")

    # The saved tokenizer_config has an invalid class name.
    # Load tokenizer from the base model instead (same vocabulary).
    BASE_MODEL = "pysentimiento/robertuito-base-uncased"
    try:
        tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    except (ValueError, OSError):
        print(f"       [INFO] Local tokenizer broken, loading from {BASE_MODEL}")
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.to(device)
    model.eval()
    print(f"       Model loaded on {device}. Labels: {model.config.num_labels}")
    return tokenizer, model


# ── Load data ────────────────────────────────────────────

def load_data():
    print(f"[2/5] Loading data from {DATA_CSV.name}...")
    rows = []
    with open(DATA_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    # Collect unique topics and videos
    topics = {}
    videos = {}
    for row in rows:
        tema_id = row.get("id_tema", "")
        tema_nombre = row.get("tema_nombre", "").strip()
        tema_desc = row.get("tema_descripcion", "").strip()
        categoria = row.get("categoria", "").strip()
        video_id = row.get("video_id", "").strip()

        if tema_nombre and tema_nombre not in topics:
            topics[tema_nombre] = {
                "nombre": tema_nombre,
                "descripcion": tema_desc,
                "categoria": categoria,
            }
        if video_id and video_id not in videos:
            videos[video_id] = {
                "video_id_tiktok": video_id,
                "tema_nombre": tema_nombre,
                "total_comentarios": 0,
            }
        if video_id:
            videos[video_id]["total_comentarios"] += 1

    print(f"       {len(rows)} comments, {len(topics)} topics, {len(videos)} videos")
    return rows, topics, videos


# ── Batch inference ──────────────────────────────────────

def predict_batch(texts, tokenizer, model, device, id2label, batch_size=64):
    """Run inference in batches. Returns list of dicts with prediction results."""
    results = []
    total = len(texts)

    for i in range(0, total, batch_size):
        batch_texts = texts[i:i + batch_size]
        encoded = tokenizer(
            batch_texts,
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="pt",
        ).to(device)

        with torch.no_grad():
            logits = model(**encoded).logits

        probs = F.softmax(logits, dim=-1).cpu().numpy()

        for j, prob in enumerate(probs):
            top_idx = prob.argmax()
            top_score = float(prob[top_idx])
            is_uncertain = top_score < UNCERTAINTY_THRESHOLD

            scores = {}
            for idx, label in id2label.items():
                scores[label] = float(prob[idx])

            results.append({
                "emocion_predicha": "Incierto" if is_uncertain else id2label[int(top_idx)],
                "confianza_maxima": round(top_score, 4),
                "es_incierto": is_uncertain,
                "scores": scores,
            })

        done = min(i + batch_size, total)
        pct = done / total * 100
        print(f"\r       Inference: {done:,}/{total:,} ({pct:.1f}%)", end="", flush=True)

    print()
    return results


# ── Load Supabase credentials ────────────────────────────

def get_supabase_creds():
    """Read from .env.local or environment variables."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")

    if not url and ENV_FILE.exists():
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                    url = line.split("=", 1)[1]
                elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                    key = line.split("=", 1)[1]

    # Prefer service_role key from env
    svc_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if svc_key:
        key = svc_key

    return url, key


# ── Upload to Supabase ───────────────────────────────────

def upload_to_supabase(rows, predictions, topics, videos, dry_run=False):
    url, key = get_supabase_creds()
    if not url or not key:
        print("[ERROR] Supabase credentials not found.")
        print("        Set SUPABASE_URL + SUPABASE_KEY env vars, or ensure .env.local exists.")
        sys.exit(1)

    print(f"[4/5] Connecting to Supabase: {url[:40]}...")

    if dry_run:
        confident = [p for p in predictions if not p["es_incierto"]]
        skipped_dr = len(predictions) - len(confident)
        print(f"       [DRY RUN] Skipping upload.")
        print(f"       Se subirían {len(confident):,} predicciones confiables ({skipped_dr:,} inciertos excluidos)")
        emotion_counts = Counter(p["emocion_predicha"] for p in confident)
        for emotion, count in emotion_counts.most_common():
            print(f"         {emotion}: {count}")
        return

    from supabase import create_client

    sb = create_client(url, key)

    # 4a. Insert topics
    print("       Inserting topics...")
    topic_id_map = {}
    for t in topics.values():
        try:
            result = sb.table("temas_produccion").upsert(
                {"nombre": t["nombre"], "descripcion": t["descripcion"], "categoria": t["categoria"]},
                on_conflict="nombre"
            ).execute()
            if result.data:
                topic_id_map[t["nombre"]] = result.data[0]["id"]
        except Exception as e:
            print(f"         [WARN] Topic '{t['nombre']}': {e}")

    # Re-fetch topic IDs if upsert didn't return them
    if not topic_id_map:
        result = sb.table("temas_produccion").select("id, nombre").execute()
        for row in result.data:
            topic_id_map[row["nombre"]] = row["id"]

    print(f"       {len(topic_id_map)} topics in DB")

    # 4b. Insert videos (count confident predictions per video)
    print("       Inserting videos...")
    # Count confident predictions per video
    confident_per_video = defaultdict(int)
    for j, pred in enumerate(predictions):
        if not pred["es_incierto"]:
            vid = rows[j].get("video_id", "").strip()
            if vid:
                confident_per_video[vid] += 1

    video_id_map = {}
    for v in videos.values():
        tema_id = topic_id_map.get(v["tema_nombre"])
        vid_tiktok = v["video_id_tiktok"]
        try:
            result = sb.table("videos_analizados").upsert(
                {
                    "url": f"https://www.tiktok.com/@user/video/{vid_tiktok}",
                    "video_id_tiktok": vid_tiktok,
                    "id_tema": tema_id,
                    "total_comentarios": v["total_comentarios"],
                    "total_analizados": confident_per_video.get(vid_tiktok, 0),
                },
                on_conflict="video_id_tiktok"
            ).execute()
            if result.data:
                video_id_map[vid_tiktok] = result.data[0]["id"]
        except Exception as e:
            print(f"         [WARN] Video '{vid_tiktok[:20]}': {e}")

    # Re-fetch if needed
    if not video_id_map:
        result = sb.table("videos_analizados").select("id, video_id_tiktok").execute()
        for row in result.data:
            video_id_map[row["video_id_tiktok"]] = row["id"]

    print(f"       {len(video_id_map)} videos in DB")

    # 4c. Insert predictions in batches (SKIP uncertain)
    confident_pairs = [(rows[j], predictions[j]) for j in range(len(predictions)) if not predictions[j]["es_incierto"]]
    skipped = len(predictions) - len(confident_pairs)
    print(f"       Inserting predictions... ({len(confident_pairs):,} confident, {skipped:,} inciertos excluidos)")
    BATCH = 500
    total_to_insert = len(confident_pairs)
    inserted = 0
    failed = 0

    for i in range(0, total_to_insert, BATCH):
        batch = []
        for row, pred in confident_pairs[i:i + BATCH]:
            vid_tiktok = row.get("video_id", "").strip()
            vid_db_id = video_id_map.get(vid_tiktok)

            batch.append({
                "id_video": vid_db_id,
                "texto_original": row.get("texto_raw", "")[:2000],
                "texto_limpio": (row.get("texto_limpio", "") or "")[:2000] or None,
                "emocion_predicha": pred["emocion_predicha"],
                "confianza_maxima": pred["confianza_maxima"],
                "es_incierto": False,
                "score_alegria": round(pred["scores"].get("Alegr\u00eda", 0), 4),
                "score_confianza": round(pred["scores"].get("Confianza", 0), 4),
                "score_miedo": round(pred["scores"].get("Miedo", 0), 4),
                "score_expectacion": round(pred["scores"].get("Expectaci\u00f3n", 0), 4),
                "score_tristeza": round(pred["scores"].get("Tristeza", 0), 4),
                "score_rechazo": round(pred["scores"].get("Rechazo", 0), 4),
                "likes": int(row.get("likes", 0) or 0),
                "fecha_comentario": row.get("fecha") or None,
                "id_comment_tiktok": row.get("id_comment", "").strip() or None,
                "tipo_analisis": "batch_video",
            })

        try:
            sb.table("predicciones").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            failed += len(batch)
            print(f"\n         [ERROR] Batch {i//BATCH}: {e}")

        done = min(i + BATCH, total_to_insert)
        pct = done / total_to_insert * 100
        print(f"\r       Upload: {done:,}/{total_to_insert:,} ({pct:.1f}%) — inserted: {inserted:,}, failed: {failed}", end="", flush=True)

    print()

    # 4d. Insert session record (only counts confident predictions)
    confident_preds = [p for p in predictions if not p["es_incierto"]]
    emotion_counts = Counter(p["emocion_predicha"] for p in confident_preds)
    dominant = emotion_counts.most_common(1)[0][0] if emotion_counts else "—"
    avg_conf = sum(p["confianza_maxima"] for p in confident_preds) / max(len(confident_preds), 1)

    sb.table("sesiones_analisis").insert({
        "tipo": "batch_historico",
        "total_procesados": len(confident_preds),
        "total_inciertos": skipped,
        "emocion_dominante": dominant,
        "confianza_promedio": round(avg_conf, 4),
    }).execute()

    return inserted, failed


# ── Report ───────────────────────────────────────────────

def print_report(predictions, duration):
    emotion_counts = Counter(p["emocion_predicha"] for p in predictions)
    total = len(predictions)
    total_inciertos = sum(1 for p in predictions if p["es_incierto"])
    avg_conf = sum(p["confianza_maxima"] for p in predictions) / total

    print("\n" + "═" * 60)
    print("  REPORTE DE PREDICCIÓN BATCH")
    print("═" * 60)
    print(f"  Total comentarios:     {total:,}")
    print(f"  Tiempo de inferencia:  {duration:.1f}s ({total/duration:.0f} com/s)")
    print(f"  Confianza promedio:    {avg_conf:.4f} ({avg_conf*100:.1f}%)")
    print(f"  Inciertos:             {total_inciertos:,} ({total_inciertos/total*100:.1f}%)")
    print()
    print("  Distribución:")
    for emotion, count in emotion_counts.most_common():
        bar = "█" * int(count / total * 40)
        pct = count / total * 100
        print(f"    {emotion:<14} {count:>5}  ({pct:5.1f}%)  {bar}")
    print("═" * 60)


# ── Main ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Batch predict + upload to Supabase")
    parser.add_argument("--batch-size", type=int, default=64, help="Inference batch size")
    parser.add_argument("--dry-run", action="store_true", help="Run inference but skip upload")
    parser.add_argument("--device", default=None, help="Device: cpu/mps/cuda (auto-detect)")
    args = parser.parse_args()

    # Device selection
    if args.device:
        device = torch.device(args.device)
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")

    # Validate paths
    if not MODEL_DIR.exists():
        print(f"[ERROR] Model not found: {MODEL_DIR}")
        sys.exit(1)
    if not DATA_CSV.exists():
        print(f"[ERROR] Data not found: {DATA_CSV}")
        sys.exit(1)

    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Batch Prediction — RoBERTuito v3_pseudo                ║")
    print("║  Fase 5: corpus_sin_etiquetar → Supabase               ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    # Load
    id2label = load_label_mapping()
    tokenizer, model = load_model(device)
    rows, topics, videos = load_data()

    # Extract texts
    texts = [row.get("texto_modelo") or row.get("texto_limpio") or row.get("texto_raw", "") for row in rows]

    # Predict
    print(f"[3/5] Running inference ({args.batch_size} batch, {device})...")
    t0 = time.time()
    predictions = predict_batch(texts, tokenizer, model, device, id2label, batch_size=args.batch_size)
    duration = time.time() - t0

    # Report
    print_report(predictions, duration)

    # Upload
    result = upload_to_supabase(rows, predictions, topics, videos, dry_run=args.dry_run)
    if result:
        inserted, failed = result
        print(f"\n[5/5] ✅ Upload complete: {inserted:,} inserted, {failed} failed")
    else:
        print(f"\n[5/5] {'Dry run complete' if args.dry_run else 'Upload skipped'}")

    # Save local results
    output_path = Path(__file__).parent / "batch_results.json"
    summary = {
        "timestamp": datetime.now().isoformat(),
        "model": "robertuito_emociones_v3_pseudo",
        "total": len(predictions),
        "duration_seconds": round(duration, 1),
        "avg_confidence": round(sum(p["confianza_maxima"] for p in predictions) / len(predictions), 4),
        "total_inciertos": sum(1 for p in predictions if p["es_incierto"]),
        "distribution": dict(Counter(p["emocion_predicha"] for p in predictions)),
        "device": str(device),
        "batch_size": args.batch_size,
    }
    with open(output_path, "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"\n       Results saved to: {output_path}")


if __name__ == "__main__":
    main()
