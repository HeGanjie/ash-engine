#version 300 es

precision mediump float;

in vec2 a_position;

void main() {
    // 裁剪空间的坐标范围永远是 -1 到 1，https://webglfundamentals.org/webgl/lessons/zh_cn/webgl-fundamentals.html
    gl_Position = vec4(a_position, 0.0, 1.0);
}
