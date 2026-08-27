#!/usr/bin/env python3
"""
ingesta_dataset_ventanas.py
=================================================================
Pipeline de Ingesta y Transformación Geométrica - NeuroSynk AI Core
=================================================================
Empaquetado de telemetría biométrica en tensores 3D de TensorFlow:
- Transformación Geométrica: Distancias Euclidianas y Ángulos Relativos
  con respecto a un punto ancla (Centroide Malla Facial / Poses Basales).
- Normalización Z-Score Determinista: (X - mu) / sigma.
- Exportación de Metadatos: metadata_ingesta.json.
- Tensores 3D: [batch_size, time_steps, features].
- Optimización Pipeline: tf.data.Dataset con prefetching (AUTOTUNE).
"""

import os
import json
import argparse
from typing import Tuple, Dict, Any, List, Optional
import numpy as np
import pandas as pd

# Fijar semillas aleatorias para reproducibilidad determinista (AGENTS.md)
RANDOM_SEED: int = 42
np.random.seed(RANDOM_SEED)

# Definición de las 12 características biométricas del contrato de NeuroSynk
NUMERIC_FEATURES: List[str] = [
    'ear_mean',
    'ear_min',
    'yaw_mean',
    'yaw_std',
    'pitch_mean',
    'pitch_std',
    'frown_mean',
    'nose_delta_sum',
    'gaze_variance_mean',
    'shoulder_angle_mean',
    'mar_mean',
    'roll_angle_mean'
]

CLASS_NAMES: List[str] = [
    "ESTUDIO NORMAL / NEUTRO",
    "ENFOQUE PROFUNDO (FLOW)",
    "DISTRACCIÓN",
    "FATIGA",
    "SOBREESTIMULACIÓN",
    "AGOBIO POSTURAL"
]


class GeometricFeatureTransformer:
    """
    Aplica transformaciones geométricas invariantes a la posición del usuario
    mediante distancias euclidianas y ángulos relativos a un punto ancla facial.
    """
    def __init__(self, anchor_point: Optional[np.ndarray] = None) -> None:
        # Punto ancla predeterminado en el origen o centro de la malla facial (x0, y0, z0)
        self.anchor_point: np.ndarray = anchor_point if anchor_point is not None else np.array([0.5, 0.5, 0.0])

    def transform_point_coordinates(self, coords: np.ndarray) -> np.ndarray:
        """
        Convierte coordenadas absolutas [N, 3] en [Distancia_Euclidiana, Yaw_Angulo, Pitch_Angulo].
        X: coords [N, 3] (x, y, z)
        """
        diff = coords - self.anchor_point
        # Distancia euclidiana d = sqrt(dx^2 + dy^2 + dz^2)
        euclidean_dist = np.linalg.norm(diff, axis=1, keepdims=True)
        
        # Ángulo azimutal / Yaw = arctan2(dy, dx)
        azimuth_yaw = np.arctan2(diff[:, 1:2], diff[:, 0:1])
        
        # Ángulo de elevación / Pitch = arcsin(dz / (d + eps))
        eps = 1e-7
        elevation_pitch = np.arcsin(np.clip(diff[:, 2:3] / (euclidean_dist + eps), -1.0, 1.0))

        return np.hstack([euclidean_dist, azimuth_yaw, elevation_pitch])

    def transform_telemetry_features(self, df_features: pd.DataFrame) -> np.ndarray:
        """
        Aplica transformaciones geométricas vectoriales sobre la matriz de telemetría de 12D.
        Calcula la norma euclidiana del vector posicional y las desviaciones angulares relativas.
        """
        data = df_features[NUMERIC_FEATURES].values.astype(np.float32)

        # Extraer vectores de orientación postural y facial
        # Yaw & Pitch centrados en 0.5 (posición basal neutra)
        yaw_vec = data[:, 2] - 0.5   # yaw_mean - anchor_yaw
        pitch_vec = data[:, 4] - 0.5 # pitch_mean - anchor_pitch
        roll_vec = data[:, 11] - 0.5 # roll_angle_mean - anchor_roll

        # Distancia euclidiana tridimensional del vector de orientación facial
        spatial_diff = np.column_stack([yaw_vec, pitch_vec, roll_vec])
        euclidean_distance = np.linalg.norm(spatial_diff, axis=1, keepdims=True)

        # Ángulo relativo respecto al origen basal (en radianes)
        eps = 1e-7
        relative_angle_theta = np.arctan2(pitch_vec, yaw_vec).reshape(-1, 1)
        relative_angle_phi = np.arccos(np.clip(roll_vec / (euclidean_distance.ravel() + eps), -1.0, 1.0)).reshape(-1, 1)

        # Reemplazar métricas de orientación crudas por las transformadas geométricas invariantes
        transformed_data = data.copy()
        transformed_data[:, 2] = euclidean_distance.ravel()   # Distancia Euclidiana en columna yaw_mean
        transformed_data[:, 4] = relative_angle_theta.ravel()  # Ángulo Relativo Theta en columna pitch_mean
        transformed_data[:, 11] = relative_angle_phi.ravel()   # Ángulo Relativo Phi en columna roll_angle_mean

        return transformed_data


class ZScoreScaler:
    """
    Escalador Z-Score Determinista: Z = (X - mu) / sigma
    Conserva y exporta parametros estadisticos deterministas.
    """
    def __init__(self) -> None:
        self.means: Optional[np.ndarray] = None
        self.stds: Optional[np.ndarray] = None

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        """
        X: Tensor2D [N, features]
        """
        self.means = np.mean(X, axis=0)
        self.stds = np.std(X, axis=0)
        # Reemplazar desviaciones cero con 1.0 para evitar division por cero
        self.stds[self.stds < 1e-7] = 1.0

        return (X - self.means) / self.stds

    def transform(self, X: np.ndarray) -> np.ndarray:
        if self.means is None or self.stds is None:
            raise ValueError("ZScoreScaler no ha sido ajustado. Llama a fit_transform primero.")
        return (X - self.means) / self.stds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_means": self.means.tolist() if self.means is not None else [],
            "feature_stds": self.stds.tolist() if self.stds is not None else [],
            "feature_names": NUMERIC_FEATURES,
            "random_seed": RANDOM_SEED
        }


def pack_sequences_3d(X_2d: np.ndarray, y_1d: np.ndarray, time_steps: int = 10) -> Tuple[np.ndarray, np.ndarray]:
    """
    Empaqueta datos 2D [N, features] en tensores 3D secuenciales [num_samples, time_steps, features].
    X_2d: Tensor2D [N, F]
    y_1d: Tensor1D [N]
    Retorna: (X_3d [num_samples, T, F], y_3d [num_samples])
    """
    num_rows, num_features = X_2d.shape
    if num_rows < time_steps:
        # Si la secuencia es menor a time_steps, aplicar padding por repeticion
        pad_size = time_steps - num_rows
        X_padded = np.pad(X_2d, ((0, pad_size), (0, 0)), mode='edge')
        X_3d = np.expand_dims(X_padded, axis=0)
        y_3d = np.array([y_1d[-1]])
        return X_3d, y_3d

    X_seqs: List[np.ndarray] = []
    y_seqs: List[int] = []

    for i in range(num_rows - time_steps + 1):
        window = X_2d[i : i + time_steps]
        # La etiqueta corresponde al ultimo paso de tiempo de la ventana
        target_label = y_1d[i + time_steps - 1]
        X_seqs.append(window)
        y_seqs.append(target_label)

    return np.array(X_seqs, dtype=np.float32), np.array(y_seqs, dtype=np.int32)


def build_tf_dataset(
    X_3d: np.ndarray,
    y: np.ndarray,
    batch_size: int = 32,
    shuffle: bool = True,
    buffer_size: int = 1000
) -> Any:
    """
    Empaqueta tensores 3D en un tf.data.Dataset optimizado con shuffling y prefetching.
    X_3d: np.ndarray [batch_size, time_steps, features]
    y: np.ndarray [batch_size]
    Retorna: tf.data.Dataset (o dict NumPy de respaldo si TensorFlow no está instalado)
    """
    try:
        import tensorflow as tf

        # Crear dataset desde slices de tensores numpy
        dataset = tf.data.Dataset.from_tensor_slices((X_3d, y))

        if shuffle:
            dataset = dataset.shuffle(buffer_size=buffer_size, seed=RANDOM_SEED)

        dataset = dataset.batch(batch_size)
        dataset = dataset.prefetch(buffer_size=tf.data.AUTOTUNE)

        return dataset
    except ImportError:
        print("[WARN] TensorFlow no está disponible directamente. Exportando estructura de Tensores 3D NumPy.")
        return {
            "X_3d": X_3d,
            "y": y,
            "shape": X_3d.shape,
            "batch_size": batch_size
        }


def process_and_export_ingestion(
    csv_path: str,
    metadata_out_path: str = "metadata_ingesta.json",
    time_steps: int = 10,
    batch_size: int = 32
) -> Tuple[Any, Dict[str, Any]]:
    """
    Pipeline completo de Ingesta de Datos:
    1. Carga CSV
    2. Transformación Geométrica (Distancias Euclidianas & Ángulos Relativos)
    3. Escalado Z-Score Determinista
    4. Empaquetado 3D [batch_size, time_steps, features]
    5. Creación y Optimización de tf.data.Dataset con prefetching
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No se encontró el archivo CSV especificado: {csv_path}")

    print(f"[INGESTA] Cargando dataset desde: {csv_path}...")
    df = pd.read_csv(csv_path)

    # Auto-completar columnas faltantes con 0.0 para compatibilidad retroactiva
    for col in NUMERIC_FEATURES:
        if col not in df.columns:
            df[col] = 0.0

    # Extraer etiquetas de clase
    if 'label' in df.columns:
        y_labels = df['label'].values.astype(np.int32)
    elif 'label_name' in df.columns:
        # Mapear strings a indices
        label_map = {name: idx for idx, name in enumerate(CLASS_NAMES)}
        y_labels = df['label_name'].map(label_map).fillna(0).values.astype(np.int32)
    else:
        y_labels = np.zeros(len(df), dtype=np.int32)

    # 1. Transformación Geométrica Anclada
    print("[GEOMETRIA] Aplicando Transformaciones Geométricas (Distancias Euclidianas y Ángulos Relativos)...")
    transformer = GeometricFeatureTransformer()
    X_geo = transformer.transform_telemetry_features(df)

    # 2. Normalización Z-Score Determinista
    print("[ESTADISTICA] Escalando características mediante Z-Score Normalization...")
    scaler = ZScoreScaler()
    X_scaled = scaler.fit_transform(X_geo)

    # 3. Empaquetado 3D [N, time_steps, features]
    print(f"[PACKAGING] Empaquetando en tensores 3D con forma [N, {time_steps}, {X_scaled.shape[1]}]...")
    X_3d, y_3d = pack_sequences_3d(X_scaled, y_labels, time_steps=time_steps)
    print(f"[OK] Tensores 3D generados. Forma de X_3d: {X_3d.shape}, Forma de y_3d: {y_3d.shape}")

    # 4. Exportar Metadatos Estadísticos Deterministas
    metadata = scaler.to_dict()
    metadata["time_steps"] = time_steps
    metadata["num_features"] = X_scaled.shape[1]
    metadata["total_samples"] = X_3d.shape[0]
    metadata["class_names"] = CLASS_NAMES

    with open(metadata_out_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"[SAVE] Metadatos deterministas guardados en: {metadata_out_path}")

    # 5. Construcción del tf.data.Dataset Optimizado
    print("[TF.DATA] Construyendo tf.data.Dataset optimizado con prefetching (AUTOTUNE)...")
    tf_dataset = build_tf_dataset(X_3d, y_3d, batch_size=batch_size, shuffle=True)

    return tf_dataset, metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script de Ingesta Geométrica y Pipeline 3D de TensorFlow - NeuroSynk")
    parser.add_argument("--csv", type=str, default="dataset_maestro_ventanas.csv", help="Ruta al CSV de entrada")
    parser.add_argument("--output-meta", type=str, default="metadata_ingesta.json", help="Ruta de exportación de metadatos")
    parser.add_argument("--time-steps", type=int, default=10, help="Pasos de tiempo en ventanas 3D")
    parser.add_argument("--batch-size", type=int, default=32, help="Tamaño de lote")
    args = parser.parse_args()

    # Si el CSV por defecto no existe en la raíz, buscar en legacy_archive
    csv_target = args.csv
    if not os.path.exists(csv_target):
        fallback_csv = os.path.join("legacy_archive", "dataset_ventanas_nuevo.csv")
        if os.path.exists(fallback_csv):
            csv_target = fallback_csv

    tf_ds, meta = process_and_export_ingestion(
        csv_path=csv_target,
        metadata_out_path=args.output_meta,
        time_steps=args.time_steps,
        batch_size=args.batch_size
    )

    print("\n[ÉXITO] Pipeline de Ingesta de Datos ejecutado y optimizado correctamente.")
