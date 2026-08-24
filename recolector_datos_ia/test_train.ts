import * as fs from 'fs';
import * as path from 'path';
import * as tf from '@tensorflow/tfjs';

interface WindowRow {
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
  label: number;
  label_name: string;
}

function parseCSV(filePath: string): WindowRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: WindowRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 12) continue;
    const label = parseInt(cols[10], 10);
    if (isNaN(label) || label < 0 || label > 4) continue;

    rows.push({
      ear_mean: parseFloat(cols[0]),
      ear_min: parseFloat(cols[1]),
      yaw_mean: parseFloat(cols[2]),
      yaw_std: parseFloat(cols[3]),
      pitch_mean: parseFloat(cols[4]),
      pitch_std: parseFloat(cols[5]),
      frown_mean: parseFloat(cols[6]),
      nose_delta_sum: parseFloat(cols[7]),
      gaze_variance_mean: parseFloat(cols[8]),
      shoulder_angle_mean: parseFloat(cols[9]),
      label: label,
      label_name: cols[11] || 'UNKNOWN'
    });
  }
  return rows;
}

async function runTrainingTest() {
  console.log('================================================================');
  console.log('🧠 ENTRENAMIENTO INDUSTRIAL CON DATA AUGMENTATION (TENSORFLOW.JS)');
  console.log('================================================================');

  let csvPath = path.resolve('c:/Users/bljos/neurosynk/dataset_ventanas_aumentado.csv');
  if (!fs.existsSync(csvPath)) {
    csvPath = path.resolve('c:/Users/bljos/neurosynk/dataset_ventanas_nuevo.csv');
  }

  const data = parseCSV(csvPath);
  console.log(`📁 Muestras cargadas desde: ${csvPath}`);
  console.log(`📊 Total ventanas procesadas: ${data.length}`);

  // Barajar datos
  const shuffled = data.sort(() => Math.random() - 0.5);

  const rawX = shuffled.map(d => [
    d.ear_mean, d.ear_min, d.yaw_mean, d.yaw_std,
    d.pitch_mean, d.pitch_std, d.frown_mean,
    d.nose_delta_sum, d.gaze_variance_mean, d.shoulder_angle_mean
  ]);
  const rawY = shuffled.map(d => d.label);

  const numSamples = rawX.length;
  const numFeatures = rawX[0].length;

  // Normalización Z-Score exacta
  const featureMeans: number[] = new Array(numFeatures).fill(0);
  const featureStds: number[] = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < numSamples; i++) sum += rawX[i][j];
    featureMeans[j] = sum / numSamples;

    let sqDiffSum = 0;
    for (let i = 0; i < numSamples; i++) sqDiffSum += Math.pow(rawX[i][j] - featureMeans[j], 2);
    featureStds[j] = Math.sqrt(sqDiffSum / numSamples) || 1.0;
  }

  const normalizedX = rawX.map(row => row.map((v, idx) => (v - featureMeans[idx]) / featureStds[idx]));

  const splitIdx = Math.floor(numSamples * 0.85);
  const trainX = tf.tensor2d(normalizedX.slice(0, splitIdx), [splitIdx, numFeatures]);
  const trainY = tf.oneHot(tf.tensor1d(rawY.slice(0, splitIdx), 'int32'), 5);
  const valX = tf.tensor2d(normalizedX.slice(splitIdx), [numSamples - splitIdx, numFeatures]);
  const valY = tf.oneHot(tf.tensor1d(rawY.slice(splitIdx), 'int32'), 5);

  // Arquitectura Neuronal Profunda Avanzada (64 -> 32 -> 16 -> 5)
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [numFeatures] }));
  model.add(tf.layers.dropout({ rate: 0.15 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.10 }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 5, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log('\n🚀 Iniciando 60 épocas de entrenamiento...\n');

  await model.fit(trainX, trainY, {
    epochs: 60,
    batchSize: 16,
    validationData: [valX, valY],
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch: number, logs: any) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          const acc = (logs.acc * 100).toFixed(1);
          const valAcc = ((logs.val_acc ?? logs.acc) * 100).toFixed(1);
          console.log(`  📊 Época ${(epoch + 1).toString().padStart(2, '0')}/60 ── Loss: ${logs.loss.toFixed(4)} ── Train Acc: ${acc}% ── Val Acc: ${valAcc}%`);
        }
      }
    }
  });

  // Evaluación final
  const evalResult = model.evaluate(valX, valY) as tf.Scalar[];
  const finalLoss = evalResult[0].dataSync()[0];
  const finalAcc = evalResult[1].dataSync()[0];

  console.log('\n================================================================');
  console.log(`🏆 ENTRENAMIENTO EXITOSO:`);
  console.log(`  Precisión en Validación: ${(finalAcc * 100).toFixed(1)}%`);
  console.log(`  Pérdida en Validación:   ${finalLoss.toFixed(4)}`);
  console.log('================================================================');

  // Guardar modelo a disco local
  const outDir = path.resolve('c:/Users/bljos/neurosynk/modelo_entrenado_tfjs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await model.save(tf.io.withSaveHandler(async (artifacts: any) => {
    fs.writeFileSync(
      path.join(outDir, 'model.json'),
      JSON.stringify(
        {
          modelTopology: artifacts.modelTopology,
          format: artifacts.format,
          generatedBy: artifacts.generatedBy,
          convertedBy: artifacts.convertedBy,
          weightsManifest: [
            {
              paths: ['./weights.bin'],
              weights: artifacts.weightSpecs
            }
          ]
        },
        null,
        2
      )
    );

    if (artifacts.weightData) {
      fs.writeFileSync(path.join(outDir, 'weights.bin'), Buffer.from(artifacts.weightData));
    }
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
  }));

  // Metadata
  const metadata = {
    featureMeans,
    featureStds,
    classNames: ['ENFOQUE', 'DISTRACCIÓN', 'FATIGA', 'SOBREESTIMULACIÓN', 'AGOBIO POSTURAL'],
    accuracy: `${(finalAcc * 100).toFixed(1)}%`,
    loss: finalLoss.toFixed(4),
    epochs: 60,
    samplesCount: data.length,
    trainedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Desplegar automáticamente a neurosynk-mvp-ai/public/models/
  const publicModelsDir = path.resolve('c:/Users/bljos/neurosynk/neurosynk-mvp-ai/public/models');
  if (!fs.existsSync(publicModelsDir)) fs.mkdirSync(publicModelsDir, { recursive: true });

  fs.copyFileSync(path.join(outDir, 'model.json'), path.join(publicModelsDir, 'model.json'));
  fs.copyFileSync(path.join(outDir, 'weights.bin'), path.join(publicModelsDir, 'weights.bin'));
  fs.copyFileSync(path.join(outDir, 'metadata.json'), path.join(publicModelsDir, 'metadata.json'));

  console.log(`🚀 Modelo desplegado automáticamente en: ${publicModelsDir}`);
}

runTrainingTest().catch(console.error);
