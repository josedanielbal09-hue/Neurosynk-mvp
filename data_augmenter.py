"""
Data Augmentation Biomecánico para NeuroSynk FocusBud (Sin dependencias externas)
Genera variantes sintéticas realistas a partir del Dataset Maestro consolidado
preservando correlaciones fisiológicas y balanceando las 5 clases.
"""

import os
import csv
import random
import math
from collections import Counter, defaultdict

def gauss(mu, sigma):
    return random.gauss(mu, sigma)

def clip(val, min_val, max_val):
    return max(min_val, min(max_val, val))

def augment_sample(row, noise_level=0.025):
    """
    Aplica perturbación gaussiana controlada respetando límites fisiológicos
    """
    # 1. EAR (Apertura ocular: [0.15, 0.65])
    ear_mean = clip(float(row['ear_mean']) + gauss(0, noise_level * 0.5), 0.15, 0.65)
    ear_min = clip(float(row['ear_min']) + gauss(0, noise_level * 0.5), 0.10, ear_mean)

    # 2. Yaw (Giro horizontal: [-0.6, 1.6])
    yaw_mean = float(row['yaw_mean']) + gauss(0, noise_level * 0.8)
    yaw_std = max(0.005, float(row['yaw_std']) + gauss(0, noise_level * 0.3))

    # 3. Pitch (Inclinación vertical: [0.1, 0.9])
    pitch_mean = clip(float(row['pitch_mean']) + gauss(0, noise_level * 0.8), 0.15, 0.90)
    pitch_std = max(0.005, float(row['pitch_std']) + gauss(0, noise_level * 0.3))

    # 4. Ceño (Distancia interciliar: [0.30, 0.55])
    frown_mean = clip(float(row['frown_mean']) + gauss(0, noise_level * 0.4), 0.30, 0.55)

    # 5. Delta Nariz (Inquietud motora: >= 0.0)
    nose_delta_sum = max(0.01, float(row['nose_delta_sum']) + gauss(0, noise_level * 1.2))

    # 6. Varianza de Mirada (>= 0.0)
    gaze_variance_mean = max(0.0001, float(row['gaze_variance_mean']) + gauss(0, 0.0002))

    # 7. Ángulo de Hombros ([70°, 280°])
    shoulder_angle_mean = clip(float(row['shoulder_angle_mean']) + gauss(0, 1.5), 70.0, 280.0)

    return {
        'ear_mean': f"{ear_mean:.4f}",
        'ear_min': f"{ear_min:.4f}",
        'yaw_mean': f"{yaw_mean:.4f}",
        'yaw_std': f"{yaw_std:.4f}",
        'pitch_mean': f"{pitch_mean:.4f}",
        'pitch_std': f"{pitch_std:.4f}",
        'frown_mean': f"{frown_mean:.4f}",
        'nose_delta_sum': f"{nose_delta_sum:.4f}",
        'gaze_variance_mean': f"{gaze_variance_mean:.4f}",
        'shoulder_angle_mean': f"{shoulder_angle_mean:.4f}",
        'label': row['label'],
        'label_name': row['label_name']
    }

def main():
    input_file = r'c:\Users\bljos\neurosynk\dataset_maestro_ventanas.csv'
    if not os.path.exists(input_file):
        input_file = 'dataset_ventanas_nuevo.csv'

    print(f"Cargando Dataset Maestro desde: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = list(csv.DictReader(f))

    # Conteo por clase
    by_class = defaultdict(list)
    for r in reader:
        lbl = int(r['label'])
        if lbl >= 0:
            by_class[lbl].append(r)

    print("\nDistribución real antes de aumentar:")
    for lbl, rows in sorted(by_class.items()):
        print(f"  Clase {lbl} [{rows[0]['label_name']}]: {len(rows)} muestras reales")

    # Objetivo: 200 muestras por clase (total 1,000 muestras masivas)
    target_per_class = 200
    augmented_rows = []

    for lbl, rows in by_class.items():
        # Incluir todas las originales
        for r in rows:
            augmented_rows.append({
                'ear_mean': r['ear_mean'],
                'ear_min': r['ear_min'],
                'yaw_mean': r['yaw_mean'],
                'yaw_std': r['yaw_std'],
                'pitch_mean': r['pitch_mean'],
                'pitch_std': r['pitch_std'],
                'frown_mean': r['frown_mean'],
                'nose_delta_sum': r['nose_delta_sum'],
                'gaze_variance_mean': r['gaze_variance_mean'],
                'shoulder_angle_mean': r['shoulder_angle_mean'],
                'label': r['label'],
                'label_name': r['label_name']
            })

        # Generar aumentos sintéticos para completar 200 por clase
        needed = target_per_class - len(rows)
        for _ in range(needed):
            source_row = random.choice(rows)
            aug = augment_sample(source_row)
            augmented_rows.append(aug)

    output_file = r'c:\Users\bljos\neurosynk\dataset_ventanas_aumentado.csv'
    fieldnames = [
        'ear_mean', 'ear_min', 'yaw_mean', 'yaw_std',
        'pitch_mean', 'pitch_std', 'frown_mean', 'nose_delta_sum',
        'gaze_variance_mean', 'shoulder_angle_mean', 'label', 'label_name'
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(augmented_rows)

    print(f"\n[OK] DATASET AUMENTADO GENERADO CON EXITO: {output_file}")
    print(f"Total Muestras Generadas: {len(augmented_rows)}")
    final_counts = Counter(r['label_name'] for r in augmented_rows)
    for name, cnt in sorted(final_counts.items()):
        print(f"  [{name}]: {cnt} muestras")

if __name__ == '__main__':
    main()
