#version 300 es

precision mediump float;

out vec4 glFragColor;
void main() {
    glFragColor = vec4(gl_FragCoord.zzz, 1.0);
    // gl_FragDepth = gl_FragCoord.z;
}
