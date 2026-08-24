import * as tf from '@tensorflow/tfjs';
import { WindowRecord } from './csvExporter';

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

export interface TrainingResult {
  model: tf.LayersModel;
  finalAccuracy: number;
  finalLoss: number;
  featureMeans: number[];
  featureStds: number[];
}

export const CLASS_NAMES = [
  'ESTUDIO NORMAL / NEUTRO',
  'ENFOQUE PROFUNDO (FLOW)',
  'DISTRACCIÓN',
  'FATIGA',
  'SOBREESTIMULACIÓN',
  'AGOBIO POSTURAL'
];

/**
 * Entrena una Red Neuronal en el navegador con TensorFlow.js usando las ventanas del Dataset
 */
export async function trainNeuroSynkModel(
  windows: WindowRecord[],
  epochs = 60,
  onProgress?: (progress: TrainingProgress) => void
): Promise<TrainingResult> {
  if (windows.length < 5) {
    throw new Error('Se necesitan al menos 5 ventanas de datos para entrenar.');
  }

  // 1. Extraer características (X) y etiquetas (y)
  const rawX: number[][] = [];
  const rawY: number[] = [];

  windows.forEach(w => {
    if (w.label >= 0 && w.label <= 5) {
      rawX.push([
        w.ear_mean,
        w.ear_min,
        w.yaw_mean,
        w.yaw_std,
        w.pitch_mean,
        w.pitch_std,
        w.frown_mean,
        w.nose_delta_sum,
        w.gaze_variance_mean,
        w.shoulder_angle_mean,
        w.mar_mean ?? 0.05,
        w.roll_angle_mean ?? 0.0
      ]);
      rawY.push(w.label);
    }
  });

  const numSamples = rawX.length;
  const numFeatures = rawX[0].length; // 12 características

  // 2. Normalización de características (Z-Score Normalization)
  const featureMeans: number[] = new Array(numFeatures).fill(0);
  const featureStds: number[] = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < numSamples; i++) {
      sum += rawX[i][j];
    }
    featureMeans[j] = sum / numSamples;

    let sqDiffSum = 0;
    for (let i = 0; i < numSamples; i++) {
      sqDiffSum += Math.pow(rawX[i][j] - featureMeans[j], 2);
    }
    featureStds[j] = Math.sqrt(sqDiffSum / numSamples) || 1.0;
  }

  // Aplicar normalización a las entradas
  const normalizedX: number[][] = rawX.map(row =>
    row.map((val, idx) => (val - featureMeans[idx]) / featureStds[idx])
  );

  // 3. Crear Tensores de TensorFlow.js
  const numClasses = Math.max(CLASS_NAMES.length, Math.max(...rawY) + 1);
  const tensorX = tf.tensor2d(normalizedX, [numSamples, numFeatures]);
  const tensorY = tf.oneHot(tf.tensor1d(rawY, 'int32'), numClasses);

  // 4. Arquitectura de la Red Neuronal
  const model = tf.sequential();

  // Capa de Entrada + Primera Capa Oculta
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [numFeatures],
      kernelInitializer: 'heNormal'
    })
  );

  // Dropout sutil para evitar sobreajuste (overfitting)
  model.add(tf.layers.dropout({ rate: 0.15 }));

  // Segunda Capa Oculta
  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: 'heNormal'
    })
  );

  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelInitializer: 'heNormal'
    })
  );

  // Capa de Salida con Softmax
  model.add(
    tf.layers.dense({
      units: numClasses,
      activation: 'softmax'
    })
  );

  // 5. Compilación del Modelo
  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  let lastAcc = 0;
  let lastLoss = 0;

  // 6. Entrenamiento
  await model.fit(tensorX, tensorY, {
    epochs: epochs,
    batchSize: Math.min(16, Math.max(4, Math.floor(numSamples / 4))),
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        lastAcc = logs?.acc ?? logs?.accuracy ?? 0;
        lastLoss = logs?.loss ?? 0;
        if (onProgress) {
          onProgress({
            epoch: epoch + 1,
            totalEpochs: epochs,
            loss: lastLoss,
            accuracy: lastAcc
          });
        }
        // Ceder el hilo para mantener la interfaz fluida
        await tf.nextFrame();
      }
    }
  });

  // Liberar memoria de tensores de entrenamiento
  tensorX.dispose();
  tensorY.dispose();

  return {
    model,
    finalAccuracy: lastAcc,
    finalLoss: lastLoss,
    featureMeans,
    featureStds
  };
}

/**
 * Descarga el modelo entrenado (model.json + weights.bin) a la carpeta de descargas del usuario
 */
export async function exportTrainedModel(model: tf.LayersModel, filename = 'modelo_neurosynk_ia') {
  await model.save(`downloads://${filename}`);
}

/**
 * Predice el estado cognitivo a partir de un vector de 12 características en vivo
 */
export function predictCognitiveState(
  model: tf.LayersModel,
  features: number[],
  means: number[],
  stds: number[]
): { predictedClass: number; className: string; confidence: number; probabilities: number[] } {
  // Normalizar con los mismos parámetros del entrenamiento
  const normFeatures = features.map((f, i) => (f - (means[i] || 0)) / (stds[i] || 1.0));

  const inputTensor = tf.tensor2d([normFeatures], [1, normFeatures.length]);
  const outputTensor = model.predict(inputTensor) as tf.Tensor;
  const probs = Array.from(outputTensor.dataSync());

  inputTensor.dispose();
  outputTensor.dispose();

  let maxProb = -1;
  let maxIdx = 0;
  probs.forEach((p, idx) => {
    if (p > maxProb) {
      maxProb = p;
      maxIdx = idx;
    }
  });

  return {
    predictedClass: maxIdx,
    className: CLASS_NAMES[maxIdx] || 'DESCONOCIDO',
    confidence: maxProb,
    probabilities: probs
  };
}
