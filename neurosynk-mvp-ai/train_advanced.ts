import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';

interface Sample {
  features: number[];
  label: number;
}

function parseCSV(filePath: string): Sample[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const samples: Sample[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(',');
    if (parts.length < 12) continue;

    const label = parseInt(parts[10], 10);
    if (isNaN(label) || label < 0 || label > 4) continue;

    const features = [
      parseFloat(parts[0]),  // ear_mean
      parseFloat(parts[1]),  // ear_min
      parseFloat(parts[2]),  // yaw_mean
      parseFloat(parts[3]),  // yaw_std
      parseFloat(parts[4]),  // pitch_mean
      parseFloat(parts[5]),  // pitch_std
      parseFloat(parts[6]),  // frown_mean
      parseFloat(parts[7]),  // nose_delta_sum
      parseFloat(parts[8]),  // gaze_variance_mean
      parseFloat(parts[9])   // shoulder_angle_mean
    ];

    if (features.some(isNaN)) continue;
    samples.push({ features, label });
  }

  return samples;
}

async function main() {
  console.log("=================================================================");
  console.log("🧠 ENTRENAMIENTO AVANZADO DE RED NEURONAL (TENSORFLOW.JS)");
  console.log("=================================================================");

  const csvPath = path.resolve('c:/Users/bljos/neurosynk/dataset_ventanas_aumentado.csv');
  console.log(`Cargando dataset aumentado: ${csvPath}`);
  const dataset = parseCSV(csvPath);
  console.log(`Total muestras cargadas: ${dataset.length}`);

  const numFeatures = 10;
  const numClasses = 5;

  // 1. Barajar datos
  const shuffled = dataset.sort(() => Math.random() - 0.5);

  // 2. Calcular medias y desviaciones estándar para Z-Score
  const featureMeans = new Array(numFeatures).fill(0);
  const featureStds = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    const vals = shuffled.map(s => s.features[j]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((sq, v) => sq + Math.pow(v - mean, 2), 0) / vals.length) || 1.0;
    featureMeans[j] = mean;
    featureStds[j] = std;
  }

  // 3. Normalizar X y One-Hot Encode Y
  const X_norm = shuffled.map(s => s.features.map((v, j) => (v - featureMeans[j]) / featureStds[j]));
  const Y_onehot = shuffled.map(s => {
    const row = new Array(numClasses).fill(0);
    row[s.label] = 1;
    return row;
  });

  const splitIdx = Math.floor(X_norm.length * 0.85);
  const trainX = tf.tensor2d(X_norm.slice(0, splitIdx), [splitIdx, numFeatures]);
  const trainY = tf.tensor2d(Y_onehot.slice(0, splitIdx), [splitIdx, numClasses]);
  const valX = tf.tensor2d(X_norm.slice(splitIdx), [X_norm.length - splitIdx, numFeatures]);
  const valY = tf.tensor2d(Y_onehot.slice(splitIdx), [X_norm.length - splitIdx, numClasses]);

  // 4. Construir Arquitectura Neuronal Avanzada (64 -> 32 -> 16 -> 5)
  const model = tf.sequential();

  // Capa Densa 1 (64 neuronas)
  model.add(tf.layers.dense({
    inputShape: [numFeatures],
    units: 64,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));

  model.add(tf.layers.dropout({ rate: 0.15 }));

  // Capa Densa 2 (32 neuronas)
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));

  model.add(tf.layers.dropout({ rate: 0.10 }));

  // Capa Densa 3 (16 neuronas)
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));

  // Capa de Salida (5 clases Softmax)
  model.add(tf.layers.dense({
    units: numClasses,
    activation: 'softmax',
    kernelInitializer: 'glorotNormal'
  }));

  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log("\nIniciando entrenamiento con 60 épocas...");
  await model.fit(trainX, trainY, {
    epochs: 60,
    batchSize: 16,
    validationData: [valX, valY],
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(`  Época ${(epoch + 1).toString().padStart(2, '0')}/60 - Pérdida: ${logs?.loss.toFixed(4)} - Precisión: ${(logs?.acc * 100).toFixed(1)}% | Val Loss: ${logs?.val_loss?.toFixed(4)} - Val Acc: ${((logs?.val_acc ?? 0) * 100).toFixed(1)}%`);
        }
      }
    }
  });

  // 5. Evaluación Final
  const evalResult = model.evaluate(valX, valY) as tf.Scalar[];
  const finalLoss = evalResult[0].dataSync()[0];
  const finalAcc = evalResult[1].dataSync()[0];

  console.log(`\n=================================================================`);
  console.log(`🏆 RESULTADO FINAL DEL ENTRENAMIENTO:`);
  console.log(`  Precisión en Validación: ${(finalAcc * 100).toFixed(1)}%`);
  console.log(`  Pérdida en Validación:   ${finalLoss.toFixed(4)}`);
  console.log(`=================================================================`);

  // 6. Guardar Modelo Exportado
  const outDir = path.resolve('c:/Users/bljos/neurosynk/modelo_entrenado_tfjs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const classNames = ["ENFOQUE", "DISTRACCIÓN", "FATIGA", "SOBREESTIMULACIÓN", "AGOBIO POSTURAL"];
  const metadata = {
    featureMeans,
    featureStds,
    classNames,
    accuracy: `${(finalAcc * 100).toFixed(1)}%`,
    loss: finalLoss.toFixed(4),
    epochs: 60,
    samplesCount: dataset.length,
    trainedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Guardar pesos y topología
  await model.save(tf.io.withSaveHandler(async (artifacts) => {
    fs.writeFileSync(path.join(outDir, 'model.json'), JSON.stringify({
      modelTopology: artifacts.modelTopology,
      format: artifacts.format,
      generatedBy: artifacts.generatedBy,
      convertedBy: artifacts.convertedBy,
      weightsManifest: [{
        paths: ['./weights.bin'],
        weights: artifacts.weightSpecs
      }]
    }, null, 2));

    if (artifacts.weightData) {
      const buffer = Buffer.from(artifacts.weightData as ArrayBuffer);
      fs.writeFileSync(path.join(outDir, 'weights.bin'), buffer);
    }
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
  }));

  console.log(`✅ Archivos de modelo exportados a: ${outDir}`);

  // Copiar directamente a neurosynk-mvp-ai/public/models/
  const publicModelsDir = path.resolve('c:/Users/bljos/neurosynk/neurosynk-mvp-ai/public/models');
  if (!fs.existsSync(publicModelsDir)) fs.mkdirSync(publicModelsDir, { recursive: true });

  fs.copyFileSync(path.join(outDir, 'model.json'), path.join(publicModelsDir, 'model.json'));
  fs.copyFileSync(path.join(outDir, 'weights.bin'), path.join(publicModelsDir, 'weights.bin'));
  fs.copyFileSync(path.join(outDir, 'metadata.json'), path.join(publicModelsDir, 'metadata.json'));

  console.log(`🚀 Modelo desplegado automáticamente en: ${publicModelsDir}`);
}

main().catch(console.error);
