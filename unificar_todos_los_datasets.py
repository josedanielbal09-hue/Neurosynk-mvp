"""
Unificador Maestro de Todos los Datasets de NeuroSynk
Consolida todas las sesiones de telemetria, anotaciones de Gemini y datasets historicos en un unico archivo CSV.
"""

import os
import sys
import csv
import glob
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def unify_all():
    print("==================================================================")
    print("📦 UNIFICADOR MAESTRO DE TODOS LOS CSVs DE NEUROSYNK")
    print("==================================================================")

    root_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(root_dir, "dataset_unificado_total_neurosynk.csv")

    candidate_files = []
    
    # 1. Archivos en la raíz
    for f in glob.glob(os.path.join(root_dir, "*.csv")):
        if "unificado" not in os.path.basename(f):
            candidate_files.append(f)

    # 2. Archivos en legacy_archive
    legacy_dir = os.path.join(root_dir, "legacy_archive")
    if os.path.exists(legacy_dir):
        for f in glob.glob(os.path.join(legacy_dir, "*.csv")):
            candidate_files.append(f)

    # 3. Archivos en Downloads si existen
    downloads_dir = os.path.expanduser("~/Downloads")
    if os.path.exists(downloads_dir):
        for f in glob.glob(os.path.join(downloads_dir, "*dataset*.csv")):
            candidate_files.append(f)

    print(f"Archivos CSV detectados para consolidar: {len(candidate_files)}")
    for f in candidate_files:
        print(f"  - {os.path.basename(f)} ({os.path.getsize(f) // 1024} KB)")

    all_rows = []
    seen_keys = set()
    sample_counter = 1

    LABEL_MAP = {
        0: "ESTUDIO NORMAL / NEUTRO",
        1: "ENFOQUE PROFUNDO (FLOW)",
        2: "DISTRACCIÓN",
        3: "FATIGA",
        4: "SOBREESTIMULACIÓN",
        5: "AGOBIO POSTURAL"
    }

    for file_path in candidate_files:
        base_name = os.path.basename(file_path)
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []
                if not headers:
                    continue

                for r in reader:
                    # Extraer caracteristicas con fallbacks robustos
                    ear_mean = float(r.get('ear_mean', r.get('ear', r.get('ear_avg', 0.35))) or 0.35)
                    ear_min = float(r.get('ear_min', ear_mean * 0.9) or 0.25)
                    ear_std = float(r.get('ear_std', 0.005) or 0.005)

                    yaw_mean = float(r.get('yaw_mean', r.get('yaw_ratio', r.get('yaw', 0.5))) or 0.5)
                    yaw_std = float(r.get('yaw_std', 0.01) or 0.01)

                    pitch_mean = float(r.get('pitch_mean', r.get('pitch_ratio', r.get('pitch', 0.6))) or 0.6)
                    pitch_std = float(r.get('pitch_std', 0.01) or 0.01)

                    roll_mean = float(r.get('roll_angle_mean', r.get('roll_angle', r.get('roll', 0.0))) or 0.0)
                    frown_mean = float(r.get('frown_mean', r.get('frown_dist', r.get('frown', r.get('eyebrow_dist', 0.4)))) or 0.4)
                    nose_delta = float(r.get('nose_delta_sum', r.get('nose_delta', 0.05)) or 0.05)
                    gaze_var = float(r.get('gaze_variance_mean', r.get('gaze_variance', 0.0001)) or 0.0001)
                    shoulder_angle = float(r.get('shoulder_angle_mean', r.get('shoulder_angle', 100.0)) or 100.0)
                    mar_mean = float(r.get('mar_mean', r.get('mar', 0.05)) or 0.05)

                    raw_label = r.get('label', '0')
                    try:
                        label_int = int(raw_label)
                    except ValueError:
                        label_int = 0

                    if label_int < 0 or label_int > 5:
                        label_int = 0

                    label_name = r.get('label_name') or LABEL_MAP.get(label_int, "ESTUDIO NORMAL / NEUTRO")
                    subject_id = r.get('subject_id', 'Sujeto_01')
                    session_id = r.get('session_id', 'Sesion_A')
                    task_name = r.get('task_name', 'Lectura_Estudio')
                    clinical_rationale = r.get('clinical_rationale', '')

                    # Clave de deduplicacion para no repetir registros identicos
                    key = (
                        round(ear_mean, 4),
                        round(yaw_mean, 4),
                        round(pitch_mean, 4),
                        round(frown_mean, 4),
                        round(shoulder_angle, 2),
                        round(mar_mean, 4),
                        round(roll_mean, 2),
                        label_int
                    )

                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    unified_row = {
                        'sample_id': sample_counter,
                        'subject_id': subject_id,
                        'session_id': session_id,
                        'task_name': task_name,
                        'ear_mean': f"{ear_mean:.4f}",
                        'ear_min': f"{ear_min:.4f}",
                        'ear_std': f"{ear_std:.4f}",
                        'yaw_mean': f"{yaw_mean:.4f}",
                        'yaw_std': f"{yaw_std:.4f}",
                        'pitch_mean': f"{pitch_mean:.4f}",
                        'pitch_std': f"{pitch_std:.4f}",
                        'roll_angle_mean': f"{roll_mean:.2f}",
                        'frown_mean': f"{frown_mean:.4f}",
                        'nose_delta_sum': f"{nose_delta:.4f}",
                        'gaze_variance_mean': f"{gaze_var:.6f}",
                        'shoulder_angle_mean': f"{shoulder_angle:.2f}",
                        'mar_mean': f"{mar_mean:.4f}",
                        'label': label_int,
                        'label_name': label_name,
                        'source_file': base_name,
                        'clinical_diagnosis': clinical_rationale
                    }
                    all_rows.append(unified_row)
                    sample_counter += 1

        except Exception as e:
            print(f"  [Aviso] Error leyendo {base_name}: {e}")

    # Guardar archivo unificado
    if all_rows:
        fieldnames = list(all_rows[0].keys())
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_rows)

        print(f"\n==================================================================")
        print(f"🎉 ¡DATASET UNIFICADO TOTAL CREADO CON ÉXITO!")
        print(f"   Archivo: {output_file}")
        print(f"   Total de muestras consolidadas: {len(all_rows)}")
        print(f"==================================================================")
    else:
        print("[Error] No se pudieron consolidar datos.")

if __name__ == "__main__":
    unify_all()
