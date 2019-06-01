#version 300 es

precision mediump float;

out vec4 glFragColor;

void main() {
    // gl_FragDepth = gl_FragCoord.z;
    glFragColor = vec4(gl_FragCoord.zzz, 1.0);
}
