import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WindowRecord {
  ear_mean: number;
  ear_min: number;
  yaw_mean: number;
  yaw_std: number;
  pitch_mean: number;
  pitch_std: number;
  frown_mean: number;
  nose_delta_sum: number;
  gaze_variance_mean: number;
  shoulder_angle_mean: number;
  mar_mean: number;
  roll_angle_mean: number;
  label: number;
}

const CLASS_NAMES = [
  'ESTUDIO NORMAL / NEUTRO',
  'ENFOQUE PROFUNDO (FLOW)',
  'DISTRACCIÓN',
  'FATIGA',
  'SOBREESTIMULACIÓN',
  'AGOBIO POSTURAL'
];

async function trainAndExport() {
  console.log("=================================================================");
  console.log("🧠 ENTRENAMIENTO DE RED NEURONAL LOCAL TENSORFLOW.JS (12 FEATURES)");
  console.log("=================================================================");

  let datasetPath = path.resolve(__dirname, '..', '..', 'dataset_unificado_total_neurosynk.csv');
  if (!fs.existsSync(datasetPath)) {
    datasetPath = path.resolve(__dirname, '..', '..', 'dataset_ventanas_aumentado.csv');
  }
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`No se encontró el dataset en ${datasetPath}`);
  }


  const csvContent = fs.readFileSync(datasetPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const records: WindowRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < headers.length) continue;
    const label = parseInt(cols[headers.indexOf('label')]);
    if (label < 0 || isNaN(label)) continue;

    records.push({
      ear_mean: parseFloat(cols[headers.indexOf('ear_mean')]) || 0.35,
      ear_min: parseFloat(cols[headers.indexOf('ear_min')]) || 0.25,
      yaw_mean: parseFloat(cols[headers.indexOf('yaw_mean')]) || 0.5,
      yaw_std: parseFloat(cols[headers.indexOf('yaw_std')]) || 0.01,
      pitch_mean: parseFloat(cols[headers.indexOf('pitch_mean')]) || 0.6,
      pitch_std: parseFloat(cols[headers.indexOf('pitch_std')]) || 0.01,
      frown_mean: parseFloat(cols[headers.indexOf('frown_mean')]) || 0.4,
      nose_delta_sum: parseFloat(cols[headers.indexOf('nose_delta_sum')]) || 0.05,
      gaze_variance_mean: parseFloat(cols[headers.indexOf('gaze_variance_mean')]) || 0.0001,
      shoulder_angle_mean: parseFloat(cols[headers.indexOf('shoulder_angle_mean')]) || 100.0,
      mar_mean: parseFloat(cols[headers.indexOf('mar_mean')]) || 0.05,
      roll_angle_mean: parseFloat(cols[headers.indexOf('roll_angle_mean')]) || 0.0,
      label
    });
  }

  console.log(`📊 Ventanas cargadas: ${records.length} muestras balanceadas con 12 características.`);

  // 1. Matriz de características X y vector de etiquetas y
  const rawX: number[][] = records.map(r => [
    r.ear_mean,
    r.ear_min,
    r.yaw_mean,
    r.yaw_std,
    r.pitch_mean,
    r.pitch_std,
    r.frown_mean,
    r.nose_delta_sum,
    r.gaze_variance_mean,
    r.shoulder_angle_mean,
    r.mar_mean,
    r.roll_angle_mean
  ]);
  const rawY: number[] = records.map(r => r.label);

  const numSamples = rawX.length;
  const numFeatures = rawX[0].length;
  const numClasses = Math.max(CLASS_NAMES.length, Math.max(...rawY) + 1);

  // 2. Normalización Z-Score exacta
  const featureMeans: number[] = new Array(numFeatures).fill(0);
  const featureStds: number[] = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < numSamples; i++) sum += rawX[i][j];
    featureMeans[j] = sum / numSamples;

    let sqDiff = 0;
    for (let i = 0; i < numSamples; i++) sqDiff += Math.pow(rawX[i][j] - featureMeans[j], 2);
    featureStds[j] = Math.sqrt(sqDiff / numSamples) || 1.0;
  }

  const normalizedX: number[][] = rawX.map(row =>
    row.map((val, idx) => (val - featureMeans[idx]) / featureStds[idx])
  );

  // 3. Tensores
  const tensorX = tf.tensor2d(normalizedX, [numSamples, numFeatures]);
  const tensorY = tf.oneHot(tf.tensor1d(rawY, 'int32'), numClasses);

  // 4. Arquitectura de Red Neuronal Profunda
  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [numFeatures],
      kernelInitializer: 'heNormal'
    })
  );
  model.add(tf.layers.dropout({ rate: 0.15 }));

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: 'heNormal'
    })
  );
  model.add(tf.layers.dropout({ rate: 0.10 }));

  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelInitializer: 'heNormal'
    })
  );

  model.add(
    tf.layers.dense({
      units: numClasses,
      activation: 'softmax'
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.004),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log(`🚀 Entrenando Red Neuronal durante 80 épocas...`);

  let lastLoss = 1.0;
  let lastAcc = 0.5;

  await model.fit(tensorX, tensorY, {
    epochs: 80,
    batchSize: 16,
    shuffle: true,
    validationSplit: 0.15,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 20 === 0 || epoch === 79) {
          lastLoss = logs?.loss || 0;
          lastAcc = logs?.acc || 0;
          console.log(`  Época [${epoch + 1}/80] -> Pérdida: ${lastLoss.toFixed(4)} | Precisión: ${(lastAcc * 100).toFixed(1)}%`);
        }
      }
    }
  });

  // 5. Exportar a neurosynk-mvp-ai/public/models
  const exportDir = path.resolve(__dirname, '..', 'public', 'models');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Guardar weights y topology
  await model.save(tf.io.withSaveHandler(async (artifacts) => {
    const modelJsonPath = path.join(exportDir, 'model.json');
    const weightsBinPath = path.join(exportDir, 'weights.bin');

    const modelJson: any = {
      modelTopology: artifacts.modelTopology,
      format: artifacts.format,
      generatedBy: artifacts.generatedBy,
      convertedBy: artifacts.convertedBy
    };

    if (artifacts.weightSpecs) {
      modelJson.weightsManifest = [
        {
          paths: ['./weights.bin'],
          weights: artifacts.weightSpecs
        }
      ];
    }

    fs.writeFileSync(modelJsonPath, JSON.stringify(modelJson, null, 2), 'utf-8');

    if (artifacts.weightData) {
      const buffer = Buffer.from(artifacts.weightData as ArrayBuffer);
      fs.writeFileSync(weightsBinPath, buffer);
    }

    return {
      modelArtifactsInfo: {
        dateSaved: new Date(),
        modelTopologyType: 'JSON',
        modelTopologyBytes: artifacts.modelTopology ? JSON.stringify(artifacts.modelTopology).length : 0,
        weightSpecsBytes: artifacts.weightSpecs ? JSON.stringify(artifacts.weightSpecs).length : 0,
        weightDataBytes: (artifacts.weightData as any)?.byteLength || 0
      }
    };

  }));

  // Guardar metadata.json
  const metadata = {
    featureMeans,
    featureStds,
    classNames: CLASS_NAMES.slice(0, numClasses),
    accuracy: `${(lastAcc * 100).toFixed(1)}%`,
    loss: `${lastLoss.toFixed(4)}`,
    epochs: 80,
    samplesCount: numSamples,
    featureNames: [
      'ear_mean', 'ear_min', 'yaw_mean', 'yaw_std', 'pitch_mean', 'pitch_std',
      'frown_mean', 'nose_delta_sum', 'gaze_variance_mean', 'shoulder_angle_mean',
      'mar_mean', 'roll_angle_mean'
    ]
  };

  fs.writeFileSync(path.join(exportDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`\n🎉 [ÉXITO] Modelo de 12 Features desplegado en: ${exportDir}`);
  console.log(`   - model.json`);
  console.log(`   - weights.bin`);
  console.log(`   - metadata.json (Precisión: ${(lastAcc * 100).toFixed(1)}%)`);

  // Liberar memoria
  tensorX.dispose();
  tensorY.dispose();
  model.dispose();
}

trainAndExport().catch(err => {
  console.error("❌ Error durante el entrenamiento:", err);
  process.exit(1);
});
