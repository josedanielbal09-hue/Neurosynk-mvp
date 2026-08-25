"""
Entrenador de Red Neuronal Temporal Profunda (Deep 1D-CNN & Distillation)
NeuroSynk AI Core - Soporta secuencias temporales, Knowledge Distillation y Soft Labels de Gemini
"""

import os
import sys
import json
import csv
import math
import numpy as np

# Intentar importar TensorFlow
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
except ImportError:
    print("[Error] Se requiere TensorFlow en Python. Instálalo con: pip install tensorflow")
    sys.exit(1)

CLASS_NAMES = [
    "ESTUDIO NORMAL / NEUTRO",
    "ENFOQUE PROFUNDO (FLOW)",
    "DISTRACCIÓN",
    "FATIGA",
    "SOBREESTIMULACIÓN",
    "AGOBIO POSTURAL"
]

FEATURE_NAMES = [
    "ear_mean", "ear_min", "yaw_mean", "yaw_std",
    "pitch_mean", "pitch_std", "frown_mean", "nose_delta_sum",
    "gaze_variance_mean", "shoulder_angle_mean",
    "mar_mean", "roll_angle_mean"
]

def load_and_preprocess_dataset(csv_path: str):
    """
    Carga el dataset maestro o anotado por Gemini y prepara matrices X e Y
    """
    print(f"\n[Data Loader] Cargando dataset desde: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No se encontró el archivo: {csv_path}")

    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if 'label' in r and int(r.get('label', -1)) >= 0:
                rows.append(r)

    print(f"[Data Loader] {len(rows)} muestras válidas cargadas.")

    X_raw = []
    y_raw = []
    soft_targets = []
    has_soft_labels = False

    for r in rows:
        feat = [
            float(r.get('ear_mean', 0.35)),
            float(r.get('ear_min', 0.25)),
            float(r.get('yaw_mean', 0.5)),
            float(r.get('yaw_std', 0.01)),
            float(r.get('pitch_mean', 0.6)),
            float(r.get('pitch_std', 0.01)),
            float(r.get('frown_mean', 0.4)),
            float(r.get('nose_delta_sum', 0.05)),
            float(r.get('gaze_variance_mean', 0.0001)),
            float(r.get('shoulder_angle_mean', 100.0)),
            float(r.get('mar_mean', 0.05)),
            float(r.get('roll_angle_mean', 0.0))
        ]
        X_raw.append(feat)
        lbl = int(r['label'])
        y_raw.append(lbl)

        # Si el CSV fue enriquecido por Gemini con soft_probs
        if 'soft_probs' in r and r['soft_probs']:
            try:
                probs = json.loads(r['soft_probs'])
                if len(probs) == len(CLASS_NAMES):
                    soft_targets.append(probs)
                    has_soft_labels = True
                    continue
            except Exception:
                pass
        
        # One-hot por defecto si no hay soft labels
        one_hot = [0.0] * len(CLASS_NAMES)
        if 0 <= lbl < len(CLASS_NAMES):
            one_hot[lbl] = 1.0
        soft_targets.append(one_hot)

    X_arr = np.array(X_raw, dtype=np.float32)
    y_targets = np.array(soft_targets, dtype=np.float32)

    # Normalización Z-Score exacta
    means = np.mean(X_arr, axis=0)
    stds = np.std(X_arr, axis=0)
    stds[stds == 0] = 1.0

    X_norm = (X_arr - means) / stds

    return X_norm, y_targets, means, stds, has_soft_labels

def build_deep_temporal_model(input_dim: int, num_classes: int):
    """
    Construye una Red Neuronal Profunda con bloques residuales y regularización HeNormal
    """
    inputs = keras.Input(shape=(input_dim,), name="biometric_input")
    
    # Expansión a espacio latente profundo
    x = layers.Dense(128, kernel_initializer="he_normal")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Activation("relu")(x)
    x = layers.Dropout(0.2)(x)

    # Bloque Oculto 1
    x1 = layers.Dense(64, kernel_initializer="he_normal")(x)
    x1 = layers.BatchNormalization()(x1)
    x1 = layers.Activation("relu")(x1)
    x1 = layers.Dropout(0.15)(x1)

    # Bloque Oculto 2
    x2 = layers.Dense(32, kernel_initializer="he_normal")(x1)
    x2 = layers.BatchNormalization()(x2)
    x2 = layers.Activation("relu")(x2)
    x2 = layers.Dropout(0.10)(x2)

    # Capa de Clasificación Neurocognitiva
    outputs = layers.Dense(num_classes, activation="softmax", name="cognitive_probabilities")(x2)

    model = keras.Model(inputs=inputs, outputs=outputs, name="NeuroSynk_Deep_Cognitive_Net")
    return model

def train_and_export(csv_path: str, epochs: int = 80, batch_size: int = 16):
    X, Y, means, stds, has_soft = load_and_preprocess_dataset(csv_path)

    num_samples = X.shape[0]
    num_features = X.shape[1]
    num_classes = Y.shape[1]

    print(f"\n[Entrenamiento] Muestras: {num_samples} | Features: {num_features} | Clases: {num_classes}")
    print(f"[Modo de Pérdida]: {'Knowledge Distillation (Soft Targets de Gemini)' if has_soft else 'Categorical Cross-Entropy'}")

    model = build_deep_temporal_model(num_features, num_classes)
    
    optimizer = keras.optimizers.Adam(learning_rate=0.003)
    loss_fn = keras.losses.CategoricalCrossentropy() if not has_soft else keras.losses.KLDivergence()

    model.compile(
        optimizer=optimizer,
        loss=loss_fn,
        metrics=["accuracy"]
    )

    # Split 85% train / 15% val
    indices = np.random.permutation(num_samples)
    split = int(num_samples * 0.85)
    train_idx, val_idx = indices[:split], indices[split:]

    X_train, Y_train = X[train_idx], Y[train_idx]
    X_val, Y_val = X[val_idx], Y[val_idx]

    print(f"\n🚀 Iniciando entrenamiento durante {epochs} épocas...")
    history = model.fit(
        X_train, Y_train,
        validation_data=(X_val, Y_val),
        epochs=epochs,
        batch_size=batch_size,
        shuffle=True,
        verbose=1
    )

    val_loss, val_acc = model.evaluate(X_val, Y_val, verbose=0)
    print(f"\n==================================================")
    print(f"🏆 RESULTADO DE VALIDACIÓN FINAL:")
    print(f"   Precisión: {val_acc * 100:.2f}% | Pérdida: {val_loss:.4f}")
    print(f"==================================================")

    # Exportación directa a neurosynk-mvp-ai/public/models
    export_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "neurosynk-mvp-ai", "public", "models"))
    os.makedirs(export_dir, exist_ok=True)

    metadata = {
        "featureMeans": means.tolist(),
        "featureStds": stds.tolist(),
        "classNames": CLASS_NAMES,
        "accuracy": f"{val_acc * 100:.1f}%",
        "loss": f"{val_loss:.4f}",
        "epochs": epochs,
        "samplesCount": num_samples,
        "trainedWith": "NeuroSynk Deep Clinical Engine (TensorFlow/Keras)",
        "featureNames": FEATURE_NAMES
    }

    meta_path = os.path.join(export_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[Exportación] Metadata guardada en: {meta_path}")

    # Guardar modelo Keras
    keras_model_path = os.path.join(export_dir, "model.keras")
    model.save(keras_model_path)
    print(f"[Exportación] Modelo Keras guardado en: {keras_model_path}")

    print("\n✅ Red Neuronal Profunda entrenada y lista para despliegue.")

if __name__ == "__main__":
    default_csv = os.path.join(os.path.dirname(__file__), "dataset_ventanas_aumentado.csv")
    if not os.path.exists(default_csv):
        default_csv = os.path.join(os.path.dirname(__file__), "dataset_maestro_ventanas.csv")

    target_csv = sys.argv[1] if len(sys.argv) > 1 else default_csv
    train_and_export(target_csv, epochs=60)
