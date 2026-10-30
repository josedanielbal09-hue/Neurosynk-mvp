async function runTests() {
  console.log('--- 1. Testing /api/chat with Biometric Telemetry (Fatigue) ---');
  const chatRes = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Estoy atorado con este ejercicio de física, no sé por dónde empezar',
      currentStep: 'DESARROLLA la deducción del vector de aceleración',
      taskContext: 'Física Clásica',
      telemetry: {
        cognitiveState: 'FATIGA',
        focusScore: 28,
        stressLevel: 62,
        sessionMinutes: 42,
        postureState: 'NECK_TILT'
      }
    })
  });
  console.log('Status:', chatRes.status);
  const chatData = await chatRes.json();
  console.log('Reply from Baseten (Muse Spark):', chatData.reply);

  console.log('\n--- 2. Testing /api/session-debrief with Session Statistics ---');
  const debriefRes = await fetch('http://localhost:3001/api/session-debrief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Estudio de Mecánica Cuántica',
      totalMinutes: 35,
      completedStepsCount: 4,
      totalStepsCount: 4,
      averageFocus: 78,
      flowPercentage: 65,
      fatigueEventsCount: 2
    })
  });
  console.log('Status:', debriefRes.status);
  const debriefData = await debriefRes.json();
  console.log('Debrief from Baseten (Muse Spark):', debriefData.debrief);
}

runTests().catch(console.error);
