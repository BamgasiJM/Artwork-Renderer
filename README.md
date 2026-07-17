# Artwork Renderer

p5.js로 제작한 제너레이티브 아트/셰이더 아트를 프레임 단위 PNG 시퀀스로 캡처하여, Blender 등 외부 3D 툴에서 텍스처(이미지, 범프, 디스플레이스먼트)로 활용하기 위한 렌더링 도구 모음입니다.

## 프로젝트 구조

```
ARTWORK_RENDERER/
├── p5js-renderer/              # 2D 캔버스 아트워크 전용
│   ├── src/
│   │   ├── artwork.js          # 현재 사용 중인 아트워크
│   │   ├── artwork_02.js       # 교체용 아트워크 (대기 상태)
│   │   └── renderer.js         # 캡처 로직 (공통, 아트워크 무관)
│   └── p5js_renderer.html
│
└── shader-renderer/             # WEBGL 셰이더 아트워크 전용
    ├── src/
    │   ├── wave/
    │   │   ├── shaders/
    │   │   │   ├── vert.glsl
    │   │   │   └── frag.glsl
    │   │   └── artwork.js
    │   └── renderer.js
    └── shader_renderer.html
```

두 렌더러는 완전히 독립된 프로젝트입니다. 필요한 쪽의 HTML을 그때그때 열어서 사용합니다. 하나로 통합하지 않은 이유는 아래 "왜 2D와 WEBGL을 분리했는가" 항목에서 설명합니다.

---

## 핵심 설계: renderer와 artwork의 역할 분리

이 프로젝트의 가장 중요한 구조적 결정은 **p5.js의 `setup()`/`draw()`를 renderer.js가 소유**하고, 아트워크는 `setupArtwork()` / `drawArtwork()`라는 훅(hook)만 구현한다는 점입니다.

```javascript
// renderer.js가 소유
function setup() {
  createCanvas(...);
  if (typeof setupArtwork === "function") setupArtwork();
  noLoop();
}

function draw() {
  if (typeof drawArtwork === "function") drawArtwork();
  if (rendererState.active) renderFrame();
}
```

```javascript
// artwork.js는 훅만 구현
function setupArtwork() { /* 초기화 */ }
function drawArtwork()  { /* 매 프레임 그리기 */ }
```

**왜 이렇게 나눴는가**: 처음 구조는 아트워크 파일이 `setup()`/`draw()`를 직접 정의했습니다. 이 경우 캡처 로직(`renderFrame()` 호출)을 아트워크마다 매번 손으로 끼워 넣어야 하고, 실수로 빠뜨리기 쉽습니다. 실제로 초기 버전에서 `renderFrame()`이 어디서도 호출되지 않아 "화면엔 보이는데 저장은 안 되는" 문제가 발생했습니다. 원인은 캡처 트리거의 부재였고, 해결책은 캡처 책임을 아트워크로부터 완전히 분리하는 것이었습니다.

이 패턴 덕분에 새 아트워크를 추가할 때 `renderer.js`는 전혀 건드릴 필요가 없고, `artwork.js` 파일 하나(또는 폴더 하나)만 교체하면 됩니다.

---

## 캡처 흐름

1. `setup()` 실행 → `setupArtwork()` 호출 → **`noLoop()`로 첫 프레임에서 홀딩**
2. HTML 버튼 "아트워크 시작 및 녹화" 클릭 → `startRender()` → `loop()` 재개
3. 매 프레임 `draw()` 안에서 `drawArtwork()` 실행 후, `rendererState.active`가 참이면 `renderFrame()`으로 캔버스를 PNG Blob으로 캡처하여 JSZip에 저장
4. 설정된 `TOTAL_FRAMES`(= `fps × duration`)에 도달하거나 "정지 - 압축파일 생성" 버튼 클릭 시 `finishRender()` → zip 압축 → 다운로드

버튼 UI를 도입하기 전에는 키보드(`R` 키) 또는 페이지 로드 즉시 자동 시작 방식을 시도했으나, **작업 흐름상 브라우저에서 아트워크를 먼저 확인하고 원하는 타이밍에 녹화를 시작하는 것이 더 실용적**이라 판단해 버튼 컨트롤로 정착했습니다.

---

## 연산량이 큰 아트워크와 프레임 드랍 대응

`draw()`는 `requestAnimationFrame` 기반으로 호출되고, 이전 `draw()`가 끝나야 다음 `draw()`가 실행됩니다. 따라서 아트워크 연산이 아무리 무거워도 **그려지는 내용 자체(논리적 프레임 진행)는 항상 결정론적**이며, 체감 재생 속도만 느려질 뿐 결과물이 스킵되지는 않습니다.

다만 실제 위험은 `canvas.toBlob()`에 있습니다. `toBlob()`은 비동기 함수이고, 초기 구조에서는 `draw()`가 이 콜백의 완료를 기다리지 않고 곧바로 다음 프레임으로 넘어갔습니다. 아트워크 연산과 인코딩이 무거워지면 여러 프레임의 `toBlob` 콜백이 동시에 대기 상태로 쌓이고, **콜백이 호출 순서대로 완료된다는 보장이 없어** 파일명(프레임 번호)과 실제 내용이 어긋나는 경합 조건(race condition)이 발생할 수 있습니다.

**대응**: `loop()`로 자동 연속 실행하는 대신, 프레임 단위 수동 진행 방식으로 전환했습니다.

```javascript
function draw() {
  if (typeof drawArtwork === "function") {
    drawArtwork();
  }

  if (rendererState.active) {
    noLoop(); // 캡처 완료 전까지 다음 draw() 진행을 막음
    renderFrame();
  }
}

function renderFrame() {
  let canvas = document.querySelector("canvas");

  canvas.toBlob((blob) => {
    rendererState.zip.file(name, blob);
    rendererState.frame++;

    if (rendererState.frame >= TOTAL_FRAMES) {
      finishRender();
    } else if (rendererState.active) {
      redraw(); // toBlob 콜백 완료 후에만 다음 프레임 진행
    }
  });
}
```

`toBlob` 콜백이 완료된 시점에만 `redraw()`로 다음 프레임을 명시적으로 요청하므로, 프레임 순서와 번호가 항상 보장됩니다. 트레이드오프는 전체 녹화 소요 시간(실제 대기 시간)이 아트워크 연산량에 비례해 길어질 수 있다는 점이며, 이는 결과물 품질과는 무관합니다.

| | 자동 루프 방식 | 수동 스텝 방식 |
|---|---|---|
| 프레임 진행 | `loop()`로 자동 연속 실행 | `noLoop()` + `redraw()`로 수동 진행 |
| `toBlob` 콜백 겹침 | 가능함 (경합 조건 존재) | 불가능 (직렬화 보장) |
| 녹화 소요 시간 | 짧음 (신뢰성 낮음) | 연산량에 비례해 길어질 수 있음 |
| 결과 프레임 순서 | 무거운 아트워크에서 어긋날 위험 | 항상 보장됨 |

`p5js-renderer`, `shader-renderer` 두 프로젝트의 `renderer.js` 모두 이 방식을 적용했습니다.

---

## 왜 2D와 WEBGL을 분리했는가

`p5js-renderer`와 `shader-renderer`를 하나의 `renderer.js`로 통합하려는 시도도 가능했지만, 다음 이유로 별도 프로젝트로 두는 편이 낫다고 판단했습니다.

| 항목 | 2D 캔버스 | WEBGL 셰이더 |
|---|---|---|
| 캔버스 생성 | `createCanvas(w, h)` | `createCanvas(w, h, WEBGL)` |
| 초기화 방식 | 동기적 (`setupArtwork()`) | 비동기적 (`await loadShader(...)`) |
| p5 버전 | 1.11.10 (기존 안정 버전) | 2.3.0 (최신 버전 사용) |

두 렌더러를 하나로 합치면 `renderer.js`가 "지금 아트워크가 2D인지 WEBGL인지" 매번 분기 처리를 해야 합니다. 렌더러 코드에 조건 분기가 늘어날수록 아트워크 교체라는 핵심 목적에서 멀어지므로, **분기 대신 프로젝트 자체를 분리**하는 쪽을 선택했습니다.

---

## 트러블슈팅 기록: 실제로 겪은 문제와 원인

프로젝트를 진행하며 마주친 문제들을 원인과 함께 정리합니다. 비슷한 구조의 프로젝트를 만들 때 참고할 수 있습니다.

### 1. 화면엔 나오는데 캡처가 안 됨
- **원인**: `startRender()`가 `loop()`만 실행할 뿐, 프레임마다 `renderFrame()`을 호출하는 코드가 어디에도 없었음
- **교훈**: `draw()` 루프와 "캡처 트리거"는 별개의 로직입니다. 캡처는 `draw()` 안에서 명시적으로 호출되어야 하며, 이 책임은 renderer.js가 전담해야 아트워크를 바꿔도 깨지지 않습니다.

### 2. p5.js 2.3 버전에서 `preload()`가 사라짐
- **원인**: p5.js 2.3부터 `preload()`가 제거되고 `async`/`await` 방식으로 전환됨
- **대응**: `setup()`을 `async function setup()`으로 선언하고, 셰이더 로딩 시 `await loadShader(...)`로 대기. renderer.js는 `await setupArtwork()`로 아트워크 쪽의 비동기 초기화를 기다림

### 3. 셰이더 로딩 책임을 어디에 둘 것인가
- **결정**: renderer.js는 셰이더 파일의 존재 자체를 몰라야 함. 로딩 경로, 실패 처리 모두 `artwork.js`(`setupArtwork()`) 내부에서 처리
- **이유**: renderer.js가 셰이더 경로를 알게 되면 아트워크 폴더 구조가 바뀔 때마다 renderer.js도 함께 수정해야 함. 책임을 분리해야 아트워크 폴더를 통째로 복사해서 재사용할 수 있음

### 4. `type="module"`로 인한 빈 화면
- **증상**: 콘솔 에러 없이 셰이더 아트워크가 전혀 그려지지 않고 검은 화면만 캡처됨
- **원인**: `<script type="module" src="artwork.js">`로 로드하면 그 안에서 선언한 함수(`setupArtwork`, `drawArtwork`)가 **모듈 스코프에 갇혀 전역(`window`)에 등록되지 않음**. renderer.js는 `typeof setupArtwork === "function"`을 전역 스코프에서 확인하므로 이 체크가 실패하여 아트워크 함수가 아예 호출되지 않음
- **교훈**: classic script(`type` 속성 없음)와 module script(`type="module"`)는 스코프 규칙이 다릅니다. 전역 함수 등록에 의존하는 구조에서는 아트워크 스크립트에 `type="module"`을 붙이지 않아야 합니다.

### 5. 상대경로 문제
- **증상**: 셰이더 파일 404 또는 로딩 실패
- **원인**: 로컬 서버(Live Server 등)가 `index.html`이 있는 폴더가 아닌 상위 폴더를 루트로 잡고 있으면 `./src/...` 상대경로가 어긋남
- **확인 방법**: 브라우저 개발자 도구 Network 탭에서 `.glsl` 요청의 상태 코드 확인

### 6. 연산량이 큰 아트워크에서 프레임 순서가 어긋날 위험
- **원인**: `canvas.toBlob()`은 비동기이고, 초기 구조는 `loop()`로 `draw()`를 연속 실행하면서 `toBlob` 콜백 완료를 기다리지 않았음. 아트워크 연산이 무거워지면 콜백들이 동시에 쌓여 완료 순서가 호출 순서와 어긋날 수 있음
- **대응**: `draw()`에서 캡처가 활성화되면 즉시 `noLoop()`로 멈추고, `toBlob` 콜백이 완료된 시점에만 `redraw()`로 다음 프레임을 진행하도록 수정. 자세한 내용은 "연산량이 큰 아트워크와 프레임 드랍 대응" 섹션 참고
- **교훈**: 그려지는 내용 자체는 `draw()` 호출 순서에 의해 결정론적으로 보장되지만, 비동기 후처리(인코딩, 저장)가 끼어드는 순간부터는 순서 보장을 명시적으로 코드에 걸어줘야 함

---

## 아트워크 교체 방법

**2D 캔버스 아트워크** (`p5js-renderer`)
- `src/artwork.js`를 원하는 아트워크 파일로 교체하거나, `p5js_renderer.html`의 `<script src="./src/artwork.js">` 경로를 `artwork_02.js` 등으로 변경
- `setupArtwork()` / `drawArtwork()` 두 함수만 구현하면 됨. `createCanvas()`는 renderer.js가 담당하므로 아트워크 쪽에서 호출하지 않음

**WEBGL 셰이더 아트워크** (`shader-renderer`)
- `src/` 아래 새 폴더(예: `src/vortex/`)를 만들고, 그 안에 `artwork.js`와 `shaders/vert.glsl`, `shaders/frag.glsl`을 배치
- `shader_renderer.html`의 `<script src="./src/wave/artwork.js">` 경로를 새 폴더 경로로 변경
- `artwork.js`의 `setupArtwork()`에서 `await loadShader(...)`로 해당 폴더 내 셰이더 파일을 상대경로로 로드

두 경우 모두 **renderer.js와 HTML의 캔버스/버튼/캡처 로직은 손댈 필요가 없습니다.**

---

## 설정값 (`window.RENDER`)

| 키 | 설명 |
|---|---|
| `width`, `height` | 캔버스 및 출력 PNG 해상도 |
| `fps` | 초당 프레임 수 |
| `duration` | 녹화 길이(초). `fps × duration`이 총 캡처 프레임 수(`TOTAL_FRAMES`)로 계산됨 |

---

## 확장 아이디어

- 아트워크 상태 리셋: 현재 "정지" 후 재시작하면 프레임 카운트는 0으로 초기화되지만, DLA처럼 누적 상태를 갖는 아트워크는 내부 상태(`stuck`, `particles` 등)가 리셋되지 않음. 시작 버튼 클릭 시 `setupArtwork()`를 재호출하는 옵션을 추가하면 완전한 재시작이 가능함
- `window.RENDER`에 `artworkPath` 같은 값을 두고 동적으로 `<script>` 태그를 생성하는 방식(B안)도 가능하나, HTML 자체의 기능을 단순하게 유지하기 위해 현재는 HTML에서 경로를 직접 지정하는 방식을 채택함