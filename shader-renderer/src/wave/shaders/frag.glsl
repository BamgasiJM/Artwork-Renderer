#version 300 es

precision highp float;

in vec2 vTexCoord;

uniform float uTime;
uniform vec2 uResolution;

out vec4 outColor;

void main() {
  vec2 uv = vTexCoord;

  float wave = sin(uv.x * 30.0 + uTime * 2.0) * 0.5 + 0.5;

  vec3 color = vec3(uv.x, wave, uv.y);

  outColor = vec4(color, 1.0);
}