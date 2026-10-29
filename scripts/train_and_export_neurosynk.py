#!/usr/bin/env python3
"""
scripts/train_and_export_neurosynk.py
====================================================================
NeuroSynk Biometric AI Core — Training & TFJS Exporter Pipeline
Entrena la red neuronal profunda de 12 dimensiones sobre el dataset
purificado y la exporta directamente a public/models/ para inferencia
en el navegador a 60 FPS con TensorFlow.js.
====================================================================
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import json
from datetime import datetime
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score
from sklearn.utils.class_weight import compute_class_weight

import tensorflow as tf

CLASS_NAMES = [
    'ESTUDIO NORMAL / NEUTRO',
    'ENFOQUE PROFUNDO (FLOW)',
    'DISTRACCIÓN',
    'FATIGA',
    'SOBREESTIMULACIÓN',
    'AGOBIO POSTURAL'
]
N_CLASSES = len(CLASS_NAMES)

FEATURES_ORDER = [
    'ear_mean', 'ear_min', 'yaw_mean', 'yaw_std', 'pitch_mean', 'pitch_std',
    'frown_mean', 'nose_delta_sum', 'gaze_variance_mean',
    'shoulder_angle_mean', 'mar_mean', 'roll_angle_mean'
]

def main():
    print("=" * 80)
    print("🧠 NEUROSYNK BIOMETRIC AI CORE: ENTRENAMIENTO Y EXPORTACIÓN A TFJS")
    print("=" * 80)

    csv_path = "dataset_purificado_neurosynk.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"No se encontró {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"📊 Registros biométricos cargados: {len(df):,}")

    label_col = 'label_purificado' if 'label_purificado' in df.columns else 'label'
    print(f"🎯 Columna objetivo: '{label_col}'")
    counts = df[label_col].value_counts().sort_index()
    for idx, count in counts.items():
        print(f"   • [{idx}] {CLASS_NAMES[idx]}: {count:,} ventanas")

    X = df[FEATURES_ORDER].values.astype(np.float32)
    y = df[label_col].values.astype(np.int32)

    # División estratificada 85% train, 15% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    print(f"🔀 Train: {len(X_train):,} | Test: {len(X_test):,}")

    # Normalización Z-score determinista
    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train).astype(np.float32)
    X_test_s = scaler.transform(X_test).astype(np.float32)

    feature_means = [float(m) for m in scaler.mean_]
    feature_stds = [float(s) for s in scaler.scale_]

    # Balanceo por pesos de clase
    cw = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
    class_weights = {int(c): float(w) for c, w in zip(np.unique(y_train), cw)}
    print(f"⚖️ Pesos de balance calculados: {class_weights}")

    # Definición explícita de arquitectura compatible con TFJS LayersModel
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(12,), name='biometric_12d_input'),
        tf.keras.layers.Dense(64, activation='relu', kernel_initializer='he_normal', name='dense_1'),
        tf.keras.layers.BatchNormalization(name='bn_1'),
        tf.keras.layers.Dropout(0.20, name='drop_1'),
        tf.keras.layers.Dense(32, activation='relu', kernel_initializer='he_normal', name='dense_2'),
        tf.keras.layers.BatchNormalization(name='bn_2'),
        tf.keras.layers.Dropout(0.20, name='drop_2'),
        tf.keras.layers.Dense(16, activation='relu', kernel_initializer='he_normal', name='dense_3'),
        tf.keras.layers.Dense(6, activation='softmax', name='cognitive_state')
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.002),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.04),
        metrics=['accuracy']
    )

    print("\n🚀 Entrenando Red Neuronal sobre el dataset purificado (35 épocas)...")
    history = model.fit(
        X_train_s, tf.keras.utils.to_categorical(y_train, N_CLASSES),
        validation_split=0.15,
        epochs=35,
        batch_size=64,
        class_weight=class_weights,
        verbose=1
    )

    # Evaluación en Test
    y_pred_probs = model.predict(X_test_s, verbose=0)
    y_pred = y_pred_probs.argmax(axis=1)
    acc = float(accuracy_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred, average='macro', zero_division=0))

    print("\n" + "=" * 80)
    print(f"🎯 RESULTADOS DEL MODELO:")
    print(f"   • Accuracy en Test: {acc * 100:.2f}%")
    print(f"   • F1-Score Macro: {f1:.4f}")
    print("=" * 80)

    report_str = classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=3)
    print("\n📋 Reporte de Clasificación:")
    print(report_str)

    # Gráfica de diagnóstico
    os.makedirs("reportes_graficos", exist_ok=True)
    plt.style.use('dark_background')
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    fig.patch.set_facecolor('#090d16')

    # Panel 1: Curva de Precisión
    ax1 = axes[0]
    ax1.set_facecolor('#0f172a')
    ax1.plot(history.history['accuracy'], label='Train Accuracy', color='#10b981', lw=2)
    ax1.plot(history.history['val_accuracy'], label='Val Accuracy', color='#38bdf8', lw=2, ls='--')
    ax1.axhline(acc, color='#f59e0b', ls=':', label=f'Test Acc ({acc*100:.1f}%)')
    ax1.set_title('Precisión (Training vs Validation)', fontsize=12, fontweight='bold', color='#f8fafc')
    ax1.set_xlabel('Época', color='#94a3b8')
    ax1.set_ylabel('Accuracy', color='#94a3b8')
    ax1.legend(loc='lower right')
    ax1.grid(True, alpha=0.15)

    # Panel 2: Matriz de Confusión Normalizada
    ax2 = axes[1]
    ax2.set_facecolor('#0f172a')
    cm = confusion_matrix(y_test, y_pred, normalize='true')
    short_names = ['Neutro', 'Flow', 'Distracción', 'Fatiga', 'Sobreestim.', 'Agobio']
    sns.heatmap(cm, annot=True, fmt='.2f', cmap='mako', cbar=True,
                xticklabels=short_names, yticklabels=short_names, ax=ax2)
    ax2.set_title(f'Matriz de Confusión (F1: {f1:.3f})', fontsize=12, fontweight='bold', color='#f8fafc')
    ax2.set_xlabel('Predicción NeuroSynk', color='#94a3b8')
    ax2.set_ylabel('Real Biomecánico', color='#94a3b8')

    plt.tight_layout()
    output_plot = "reportes_graficos/entrenamiento_meta_hackathon.png"
    plt.savefig(output_plot, dpi=200, facecolor=fig.get_facecolor())
    plt.close()
    print(f"📊 Gráfica guardada: {output_plot}")

    # =========================================================================
    # EXPORTACIÓN DIRECTA A FORMATO TFJS (public/models/)
    # =========================================================================
    output_dir = "public/models"
    os.makedirs(output_dir, exist_ok=True)
    weights_bin_path = os.path.join(output_dir, "weights.bin")
    model_json_path = os.path.join(output_dir, "model.json")
    metadata_json_path = os.path.join(output_dir, "metadata.json")

    binary_data = bytearray()
    weights_manifest_entries = []

    # Extraer pesos de las capas entrenables y batch normalization
    # Orden de guardado idéntico al que espera TFJS
    for layer in model.layers:
        weights = layer.get_weights()
        if not weights:
            continue
        
        # En Dense: [kernel, bias]
        # En BatchNormalization: [gamma, beta, moving_mean, moving_variance]
        if isinstance(layer, tf.keras.layers.Dense):
            w_names = [f"{layer.name}/kernel", f"{layer.name}/bias"]
        elif isinstance(layer, tf.keras.layers.BatchNormalization):
            w_names = [
                f"{layer.name}/gamma",
                f"{layer.name}/beta",
                f"{layer.name}/moving_mean",
                f"{layer.name}/moving_variance"
            ]
        else:
            w_names = [f"{layer.name}/param_{i}" for i in range(len(weights))]

        for w, w_name in zip(weights, w_names):
            w_f32 = w.astype(np.float32)
            binary_data.extend(w_f32.tobytes())
            weights_manifest_entries.append({
                "name": w_name,
                "shape": list(w_f32.shape),
                "dtype": "float32"
            })

    # Escribir archivo binario
    with open(weights_bin_path, "wb") as f:
        f.write(binary_data)
    print(f"💾 Guardado: {weights_bin_path} ({len(binary_data):,} bytes)")

    # Construir model.json (formato layers-model compatible con tf.loadLayersModel)
    model_json_content = {
        "format": "layers-model",
        "generatedBy": f"TensorFlow v{tf.__version__} / NeuroSynk AI Core v3.0",
        "convertedBy": "NeuroSynk Hackathon MLOps Pipeline",
        "modelTopology": {
            "class_name": "Sequential",
            "config": {
                "name": "neurosynk_biometric_core",
                "layers": [
                    {
                        "class_name": "Dense",
                        "config": {
                            "units": 64,
                            "activation": "relu",
                            "use_bias": True,
                            "name": "dense_1",
                            "trainable": True,
                            "batch_input_shape": [None, 12],
                            "dtype": "float32"
                        }
                    },
                    {
                        "class_name": "BatchNormalization",
                        "config": {
                            "axis": -1,
                            "momentum": 0.99,
                            "epsilon": 0.001,
                            "center": True,
                            "scale": True,
                            "name": "bn_1",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "Dropout",
                        "config": {
                            "rate": 0.20,
                            "name": "drop_1",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "Dense",
                        "config": {
                            "units": 32,
                            "activation": "relu",
                            "use_bias": True,
                            "name": "dense_2",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "BatchNormalization",
                        "config": {
                            "axis": -1,
                            "momentum": 0.99,
                            "epsilon": 0.001,
                            "center": True,
                            "scale": True,
                            "name": "bn_2",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "Dropout",
                        "config": {
                            "rate": 0.20,
                            "name": "drop_2",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "Dense",
                        "config": {
                            "units": 16,
                            "activation": "relu",
                            "use_bias": True,
                            "name": "dense_3",
                            "trainable": True
                        }
                    },
                    {
                        "class_name": "Dense",
                        "config": {
                            "units": 6,
                            "activation": "softmax",
                            "use_bias": True,
                            "name": "cognitive_state",
                            "trainable": True
                        }
                    }
                ]
            },
            "keras_version": "tfjs-layers 4.22.0",
            "backend": "tensor_flow.js"
        },
        "weightsManifest": [
            {
                "paths": ["./weights.bin"],
                "weights": weights_manifest_entries
            }
        ]
    }

    with open(model_json_path, "w", encoding="utf-8") as f:
        json.dump(model_json_content, f, indent=2)
    print(f"💾 Guardado: {model_json_path}")

    # Guardar metadata.json para normalización Z-score en tiempo real
    metadata = {
        "model_name": "NeuroSynk Biometric Cognitive Engine v3.0",
        "version": "3.0.0-hackathon-purified",
        "model_version": "3.0.0",
        "architecture": "Dense-64 (BN, Drop) -> Dense-32 (BN, Drop) -> Dense-16 -> Softmax-6",
        "input_dimensions": 12,
        "featureNames": FEATURES_ORDER,
        "feature_names": FEATURES_ORDER,
        "featureMeans": feature_means,
        "feature_means": feature_means,
        "featureStds": feature_stds,
        "feature_stds": feature_stds,
        "classNames": CLASS_NAMES,
        "classes": CLASS_NAMES,
        "output_classes": N_CLASSES,
        "accuracy": f"{acc * 100:.2f}%",
        "f1_macro": float(f1),
        "total_samples": len(df),
        "sampling_rate_hz": 60,
        "class_weights": {str(k): float(v) for k, v in class_weights.items()},
        "training_date": datetime.now().isoformat(),
        "dataset_source": csv_path
    }

    with open(metadata_json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"💾 Guardado: {metadata_json_path}")

    print("\n" + "=" * 80)
    print("✨ ENTRENAMIENTO Y EXPORTACIÓN FINALIZADOS EXITOSAMENTE")
    print("=" * 80)

if __name__ == "__main__":
    main()
