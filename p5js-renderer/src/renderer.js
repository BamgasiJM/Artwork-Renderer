let rendererState = {
  active: false,
  frame: 0,
  zip: null,
};

const TOTAL_FRAMES = RENDER.fps * RENDER.duration;

function setup() {
  pixelDensity(1);
  let canvas = createCanvas(RENDER.width, RENDER.height);
  canvas.parent("canvas-holder");
  frameRate(RENDER.fps);

  if (typeof setupArtwork === "function") {
    setupArtwork();
  }

  noLoop();

  bindControls();
}

function draw() {
  if (typeof drawArtwork === "function") {
    drawArtwork();
  }

  // 캡처가 활성 상태면 여기서 루프를 멈추고, renderFrame()의 toBlob 콜백이
  // 완료된 뒤에만 redraw()로 다음 프레임을 진행시킵니다.
  // 연산량이 큰 아트워크에서 toBlob 인코딩이 draw() 호출 순서보다 늦게 끝나는
  // 경합 조건(race condition)을 방지하기 위함입니다.
  if (rendererState.active) {
    noLoop();
    renderFrame();
  }
}

function bindControls() {
  let startBtn = document.querySelector("#startBtn");
  let stopBtn = document.querySelector("#stopBtn");

  startBtn.addEventListener("click", () => {
    startRender();
    startBtn.disabled = true;
    stopBtn.disabled = false;
  });

  stopBtn.addEventListener("click", () => {
    finishRender();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
}

function startRender() {
  if (rendererState.active) return;

  rendererState.active = true;
  rendererState.frame = 0;
  rendererState.zip = new JSZip();

  updateStatus("녹화 중...");
  console.log("Render Start");

  loop();
}

function renderFrame() {
  let canvas = document.querySelector("canvas");

  canvas.toBlob((blob) => {
    let name = String(rendererState.frame + 1).padStart(4, "0") + ".png";

    rendererState.zip.file(name, blob);

    rendererState.frame++;

    updateStatus(`녹화 중... (${rendererState.frame}/${TOTAL_FRAMES})`);

    if (rendererState.frame >= TOTAL_FRAMES) {
      finishRender();
    } else if (rendererState.active) {
      // 이 프레임의 캡처가 완전히 끝난 뒤에만 다음 프레임을 그림
      redraw();
    }
  });
}

function finishRender() {
  if (!rendererState.active) return;

  rendererState.active = false;
  noLoop();

  updateStatus("압축 파일 생성 중...");

  rendererState.zip
    .generateAsync({
      type: "blob",
    })
    .then((blob) => {
      let link = document.createElement("a");

      link.href = URL.createObjectURL(blob);
      link.download = "frames.zip";
      link.click();

      updateStatus(`완료 (총 ${rendererState.frame}프레임)`);

      document.querySelector("#startBtn").disabled = false;
      document.querySelector("#stopBtn").disabled = true;
    });

  console.log("Render Finished");
}

function getRenderTime() {
  return rendererState.frame / RENDER.fps;
}

function updateStatus(text) {
  let el = document.querySelector("#status");
  if (el) el.textContent = text;
}
