let waveShader;

// 셰이더 로딩은 아트워크가 전담합니다. p5 2.3의 loadShader는 Promise를 반환하므로
// await로 로딩 완료를 기다린 뒤 renderer.js가 noLoop()로 넘어갑니다.
async function setupArtwork() {
  waveShader = await loadShader(
    "./src/wave/shaders/vert.glsl",
    "./src/wave/shaders/frag.glsl",
  );

  noStroke();
}

function drawArtwork() {
  shader(waveShader);

  waveShader.setUniform("uTime", millis() / 1000.0);
  waveShader.setUniform("uResolution", [width, height]);

  plane(width, height);
}
