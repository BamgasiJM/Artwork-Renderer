
const MAX_PARTICLES = 1000; // 동시에 존재하는 입자 수
const STICKINESS = 5;     // 응집 거리
const WALK_STEP = 2;      // 랜덤 워크 한 번에 이동하는 거리
const MAX_WALK_COUNT = 5; // 입자당 프레임당 랜덤 워크 횟수

let particles = [];
let stuck = [];
let maxRadius = 0;

function setupArtwork() {
// createCanvas는 renderer.js의 setup()이 전담하므로 여기서는 호출하지 않습니다.
  background(15);
  colorMode(RGB, 255);

  // 초기 시드 생성
  stuck.push(createVector(width / 2, height / 2));
  maxRadius = 1;
}

function drawArtwork() {
  background(15, 15, 15, 20);

  // 1. 입자 생성: 패턴 외곽에서 생성
  if (particles.length < MAX_PARTICLES) {
    let launchRadius = maxRadius + 50;
    let angle = random(TWO_PI);
    let x = width / 2 + cos(angle) * launchRadius;
    let y = height / 2 + sin(angle) * launchRadius;
    particles.push(createVector(x, y));
  }

  // 2. 입자 이동 및 응집 확인
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    // 🌟 가속화 1: 입자당 여러 번의 랜덤 워크 수행 (속도 증폭)
    for (let k = 0; k < MAX_WALK_COUNT; k++) {
      p.x += random(-WALK_STEP, WALK_STEP);
      p.y += random(-WALK_STEP, WALK_STEP);
    }

    let closestDistSq = Infinity;

    // 🌟 가속화 2: 패턴 외곽에 접근했을 때만 충돌 확인
    let distFromCenter = dist(width / 2, height / 2, p.x, p.y);
    if (distFromCenter < maxRadius + STICKINESS * 2) {
      // 입자가 응집체 근처에 도달했을 때만 N*M 충돌 검사 실행
      for (let s of stuck) {
        let dSq = (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
        closestDistSq = min(closestDistSq, dSq);
      }

      // 응집 조건
      if (closestDistSq < STICKINESS * STICKINESS) {
        stuck.push(p);
        particles.splice(i, 1);

        // 최대 반지름 업데이트
        if (distFromCenter > maxRadius) {
          maxRadius = distFromCenter;
        }
        break; // 응집 후 다음 입자로
      }
    }

    // 🌟 가속화 3: 너무 멀리 나간 입자 제거 (최대 반지름 + 1000 이상)
    // 패턴이 커질 때 효율적으로 입자를 제거하도록 범위 확장
    if (distFromCenter > maxRadius + 1000) {
      particles.splice(i, 1);
    }
  }

  // 3. 드로잉
  noStroke();
  fill(255);
  for (let s of stuck) circle(s.x, s.y, 3);

  fill(30, 190, 180);
  for (let p of particles) circle(p.x, p.y, 3);
}
