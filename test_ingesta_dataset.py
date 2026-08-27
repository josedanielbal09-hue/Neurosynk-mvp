#!/usr/bin/env python3
"""
test_ingesta_dataset.py
=================================================================
Suite de Prueba y Validación para Script de Ingesta - NeuroSynk
=================================================================
Verifica:
1. Transformación Geométrica (Distancias Euclidianas y Ángulos Relativos).
2. Normalización Z-Score (Media mu ≈ 0.0, Desviación sigma ≈ 1.0).
3. Empaquetado 3D de Tensores [batch_size, time_steps, features].
4. Estructura y Prefetching del tf.data.Dataset.
"""

import os
import unittest
import numpy as np
import pandas as pd
from ingesta_dataset_ventanas import (
    GeometricFeatureTransformer,
    ZScoreScaler,
    pack_sequences_3d,
    build_tf_dataset,
    NUMERIC_FEATURES
)

class TestIngestaDatasetPipeline(unittest.TestCase):

    def setUp(self) -> None:
        np.random.seed(42)
        self.num_samples = 100
        self.num_features = len(NUMERIC_FEATURES)
        self.time_steps = 10
        self.batch_size = 16

        # Crear dataframe sintetico de prueba
        data_dict = {}
        for feature in NUMERIC_FEATURES:
            data_dict[feature] = np.random.uniform(0.1, 1.5, size=self.num_samples)
        data_dict['label'] = np.random.randint(0, 6, size=self.num_samples)

        self.df_synthetic = pd.DataFrame(data_dict)

    def test_geometric_transformation(self) -> None:
        transformer = GeometricFeatureTransformer()
        X_geo = transformer.transform_telemetry_features(self.df_synthetic)

        self.assertEqual(X_geo.shape, (self.num_samples, self.num_features))
        self.assertFalse(np.isnan(X_geo).any(), "La transformación geométrica produjo valores NaN")
        self.assertFalse(np.isinf(X_geo).any(), "La transformación geométrica produjo valores infinitos")

    def test_z_score_scaling(self) -> None:
        transformer = GeometricFeatureTransformer()
        X_geo = transformer.transform_telemetry_features(self.df_synthetic)

        scaler = ZScoreScaler()
        X_scaled = scaler.fit_transform(X_geo)

        means = np.mean(X_scaled, axis=0)
        stds = np.std(X_scaled, axis=0)

        # Verificar que la media sea proxima a 0 y la desviacion estandar proxima a 1
        np.testing.assert_allclose(means, np.zeros(self.num_features), atol=1e-5)
        np.testing.assert_allclose(stds, np.ones(self.num_features), atol=1e-5)

    def test_3d_tensor_packaging(self) -> None:
        transformer = GeometricFeatureTransformer()
        X_geo = transformer.transform_telemetry_features(self.df_synthetic)
        scaler = ZScoreScaler()
        X_scaled = scaler.fit_transform(X_geo)
        y_labels = self.df_synthetic['label'].values

        X_3d, y_3d = pack_sequences_3d(X_scaled, y_labels, time_steps=self.time_steps)

        expected_samples = self.num_samples - self.time_steps + 1
        self.assertEqual(X_3d.shape, (expected_samples, self.time_steps, self.num_features))
        self.assertEqual(y_3d.shape, (expected_samples,))

    def test_tf_dataset_pipeline(self) -> None:
        transformer = GeometricFeatureTransformer()
        X_geo = transformer.transform_telemetry_features(self.df_synthetic)
        scaler = ZScoreScaler()
        X_scaled = scaler.fit_transform(X_geo)
        y_labels = self.df_synthetic['label'].values

        X_3d, y_3d = pack_sequences_3d(X_scaled, y_labels, time_steps=self.time_steps)
        dataset = build_tf_dataset(X_3d, y_3d, batch_size=self.batch_size, shuffle=True)

        try:
            import tensorflow as tf
            if isinstance(dataset, tf.data.Dataset):
                for batch_x, batch_y in dataset.take(1):
                    self.assertEqual(batch_x.shape[1:], (self.time_steps, self.num_features))
                    self.assertEqual(batch_x.dtype, tf.float32)
                    self.assertGreater(batch_x.shape[0], 0)
                    self.assertLessEqual(batch_x.shape[0], self.batch_size)
        except ImportError:
            self.assertIsInstance(dataset, dict)
            self.assertEqual(dataset["shape"][1:], (self.time_steps, self.num_features))

if __name__ == "__main__":
    print("[TEST] Ejecutando Suite de Pruebas de Ingesta y Transformacion 3D...")
    unittest.main()
