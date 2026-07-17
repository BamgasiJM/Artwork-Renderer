let start = 0;

// 캔버스 생성/frameRate 설정은 renderer.js가 담당하므로
// 여기서는 아트워크 자체 초기화만 처리합니다.
function setupArtwork() {
  // 필요 시 초기화 코드 작성
}

function drawArtwork() {
  background(0);
  noFill();
  stroke(255, 255, 255);
  strokeWeight(12);
  beginShape();
  let xoff = start;
  for (let x = 0; x < width; x++) {
    let y = noise(xoff) * height;
    vertex(x, y);
    xoff += 0.01;
  }
  endShape();

  start += 0.01;
}