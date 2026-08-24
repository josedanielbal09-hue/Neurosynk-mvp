"""
Reconstructor del Super Dataset Maestro NeuroSynk (12 Features con MAR y Roll)
Convierte frames crudos en ventanas rodantes de 2s y consolida TODOS los CSVs de descargas y workspace.
"""

import os
import csv
import glob
import math
import random
from collections import defaultdict

def calculate_window_from_frames(frames):
    """Calcula el vector de 12 caracteristicas a partir de una lista de frames de 2s"""
    n = len(frames)
    if n == 0:
        return None

    ears = [float(f.get('ear', 0.35)) for f in frames]
    yaws = [float(f.get('yaw_ratio', f.get('yaw', 0.5))) for f in frames]
    pitches = [float(f.get('pitch_ratio', f.get('pitch', 0.6))) for f in frames]
    frowns = [float(f.get('eyebrow_dist', f.get('frown', 0.41))) for f in frames]
    shoulders = [float(f.get('shoulder_angle', 100.0)) for f in frames]
    nose_deltas = [float(f.get('nose_delta', 0.0)) for f in frames]
    gaze_vars = [float(f.get('gaze_variance', 0.0001)) for f in frames]
    mars = [float(f.get('mar', 0.05)) for f in frames]
    rolls = [float(f.get('roll_angle', 0.0)) for f in frames]

    ear_mean = sum(ears) / n
    ear_min = min(ears)
    yaw_mean = sum(yaws) / n
    yaw_std = math.sqrt(sum((y - yaw_mean)**2 for y in yaws) / n) if n > 1 else 0.005
    pitch_mean = sum(pitches) / n
    pitch_std = math.sqrt(sum((p - pitch_mean)**2 for p in pitches) / n) if n > 1 else 0.005
    frown_mean = sum(frowns) / n
    nose_delta_sum = sum(nose_deltas)
    gaze_variance_mean = sum(gaze_vars) / n
    shoulder_angle_mean = sum(shoulders) / n
    mar_mean = sum(mars) / n
    roll_angle_mean = sum(rolls) / n

    labels = [int(f['label']) for f in frames if int(f['label']) >= 0]
    if not labels:
        return None
    label = max(set(labels), key=labels.count)

    label_names = {
        0: "ESTUDIO NORMAL / NEUTRO",
        1: "ENFOQUE PROFUNDO",
        2: "DISTRACCIÓN",
        3: "FATIGA",
        4: "SOBREESTIMULACIÓN",
        5: "AGOBIO POSTURAL"
    }

    return {
        'ear_mean': f"{ear_mean:.4f}",
        'ear_min': f"{ear_min:.4f}",
        'yaw_mean': f"{yaw_mean:.4f}",
        'yaw_std': f"{yaw_std:.4f}",
        'pitch_mean': f"{pitch_mean:.4f}",
        'pitch_std': f"{pitch_std:.4f}",
        'frown_mean': f"{frown_mean:.4f}",
        'nose_delta_sum': f"{nose_delta_sum:.4f}",
        'gaze_variance_mean': f"{gaze_variance_mean:.6f}",
        'shoulder_angle_mean': f"{shoulder_angle_mean:.2f}",
        'mar_mean': f"{mar_mean:.4f}",
        'roll_angle_mean': f"{roll_angle_mean:.2f}",
        'label': str(label),
        'label_name': label_names.get(label, "DESCONOCIDO")
    }

def main():
    print("================================================================")
    print("[NeuroSynk] RECONSTRUCCION DE SUPER DATASET MAESTRO (12 FEATURES)")
    print("================================================================")

    search_dirs = [
        r"c:\Users\bljos\neurosynk",
        r"C:\Users\bljos\Downloads"
    ]

    all_csvs = []
    for d in search_dirs:
        if os.path.exists(d):
            all_csvs.extend(glob.glob(os.path.join(d, "*.csv")))

    print(f"Archivos CSV encontrados: {len(all_csvs)}")

    master_windows = []
    seen_fingerprints = set()

    def get_fingerprint(row):
        return f"{float(row['ear_mean']):.3f}_{float(row['yaw_mean']):.3f}_{float(row['pitch_mean']):.3f}_{row['label']}"

    # 1. Procesar CSVs de Ventanas Directas
    for csv_file in all_csvs:
        base = os.path.basename(csv_file).lower()
        if ("ventanas" in base or "maestro" in base) and "aumentado" not in base:
            try:
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    added = 0
                    for row in reader:
                        if 'label' not in row or int(row['label']) < 0:
                            continue
                        
                        # Retrocompatibilidad para mar_mean y roll_angle_mean
                        if 'mar_mean' not in row or not row['mar_mean']:
                            # Fatiga suele tener mayor apertura bucal (bostezos)
                            lbl = int(row['label'])
                            row['mar_mean'] = f"{0.18 if lbl == 2 or lbl == 3 else 0.05:.4f}"
                        if 'roll_angle_mean' not in row or not row['roll_angle_mean']:
                            row['roll_angle_mean'] = "0.00"

                        fp = get_fingerprint(row)
                        if fp not in seen_fingerprints:
                            seen_fingerprints.add(fp)
                            master_windows.append(row)
                            added += 1
                    print(f"  [Ventanas Reales] {os.path.basename(csv_file)}: +{added} ventanas agregadas.")
            except Exception as e:
                print(f"  [Error leyendo {csv_file}]: {e}")

    # 2. Procesar CSVs de Frames Crudos y computar ventanas rodantes de 2s
    for csv_file in all_csvs:
        base = os.path.basename(csv_file).lower()
        if "frames" in base:
            try:
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = list(csv.DictReader(f))
                
                if not reader:
                    continue

                added_from_frames = 0
                window_size = 20
                stride = 8
                for start_idx in range(0, len(reader) - window_size + 1, stride):
                    chunk = reader[start_idx : start_idx + window_size]
                    w = calculate_window_from_frames(chunk)
                    if w:
                        fp = get_fingerprint(w)
                        if fp not in seen_fingerprints:
                            seen_fingerprints.add(fp)
                            master_windows.append(w)
                            added_from_frames += 1
                
                print(f"  [Frames->Ventanas Reales] {os.path.basename(csv_file)}: +{added_from_frames} nuevas ventanas calculadas.")
            except Exception as e:
                print(f"  [Error procesando frames de {csv_file}]: {e}")

    print(f"\n[Total] Ventanas Reales Unicas Consolidadas: {len(master_windows)}")
    
    by_class = defaultdict(list)
    for w in master_windows:
        by_class[int(w['label'])].append(w)

    for lbl in sorted(by_class.keys()):
        print(f"  Clase {lbl} [{by_class[lbl][0].get('label_name', 'ESTADO')}]: {len(by_class[lbl])} ventanas reales")

    # Guardar Dataset Maestro con 12 características
    maestro_path = r"c:\Users\bljos\neurosynk\dataset_maestro_ventanas.csv"
    fieldnames = [
        'ear_mean', 'ear_min', 'yaw_mean', 'yaw_std', 'pitch_mean', 'pitch_std',
        'frown_mean', 'nose_delta_sum', 'gaze_variance_mean', 'shoulder_angle_mean',
        'mar_mean', 'roll_angle_mean', 'label', 'label_name'
    ]
    with open(maestro_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for w in master_windows:
            clean_row = {k: w.get(k, '0.0') for k in fieldnames}
            writer.writerow(clean_row)

    print(f"\n[OK] Guardado en: {maestro_path}")

    # 3. Data Augmentation a 2,400 Muestras Balanceadas (400 por clase para las 6 clases)
    print("\n[Augmenter] Generando Dataset Aumentado Equilibrado (400 muestras por clase)...")
    augmented_rows = []
    target_per_class = 400

    def clip(val, min_v, max_v):
        return max(min_v, min(max_v, val))

    available_classes = sorted(by_class.keys())
    for lbl in available_classes:
        rows = by_class[lbl]
        if not rows:
            continue

        for r in rows:
            augmented_rows.append(r)

        needed = target_per_class - len(rows)
        for _ in range(needed):
            base_r = random.choice(rows)
            noise = 0.025
            
            ear_m = clip(float(base_r['ear_mean']) + random.gauss(0, noise * 0.4), 0.15, 0.65)
            ear_min = clip(float(base_r['ear_min']) + random.gauss(0, noise * 0.4), 0.10, ear_m)
            yaw_m = float(base_r['yaw_mean']) + random.gauss(0, noise * 0.7)
            yaw_s = max(0.003, float(base_r['yaw_std']) + random.gauss(0, noise * 0.3))
            pitch_m = clip(float(base_r['pitch_mean']) + random.gauss(0, noise * 0.7), 0.15, 0.90)
            pitch_s = max(0.003, float(base_r['pitch_std']) + random.gauss(0, noise * 0.3))
            frown_m = clip(float(base_r['frown_mean']) + random.gauss(0, noise * 0.3), 0.30, 0.55)
            
            nose_d = max(0.01, float(base_r['nose_delta_sum']) + random.gauss(0, noise * 0.8))
            gaze_v = max(0.0001, float(base_r['gaze_variance_mean']) + random.gauss(0, 0.0002))
            shoulder_a = clip(float(base_r['shoulder_angle_mean']) + random.gauss(0, 1.2), 70.0, 260.0)
            mar_m = max(0.01, float(base_r.get('mar_mean', 0.05)) + random.gauss(0, 0.01))
            roll_m = float(base_r.get('roll_angle_mean', 0.0)) + random.gauss(0, 0.8)

            augmented_rows.append({
                'ear_mean': f"{ear_m:.4f}",
                'ear_min': f"{ear_min:.4f}",
                'yaw_mean': f"{yaw_m:.4f}",
                'yaw_std': f"{yaw_s:.4f}",
                'pitch_mean': f"{pitch_m:.4f}",
                'pitch_std': f"{pitch_s:.4f}",
                'frown_mean': f"{frown_m:.4f}",
                'nose_delta_sum': f"{nose_d:.4f}",
                'gaze_variance_mean': f"{gaze_v:.6f}",
                'shoulder_angle_mean': f"{shoulder_a:.2f}",
                'mar_mean': f"{mar_m:.4f}",
                'roll_angle_mean': f"{roll_m:.2f}",
                'label': str(lbl),
                'label_name': base_r.get('label_name', f'CLASE_{lbl}')
            })

    aumentado_path = r"c:\Users\bljos\neurosynk\dataset_ventanas_aumentado.csv"
    with open(aumentado_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in augmented_rows:
            clean_row = {k: r.get(k, '0.0') for k in fieldnames}
            writer.writerow(clean_row)

    print(f"[OK] Dataset Aumentado generado con exito: {len(augmented_rows)} muestras con 12 caracteristicas.")
    print(f"[OK] Guardado en: {aumentado_path}")

if __name__ == '__main__':
    main()
