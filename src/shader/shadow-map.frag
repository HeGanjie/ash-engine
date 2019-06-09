#version 300 es

precision mediump float;

out vec4 glFragColor;

void main() {
    // TODO use single depth layer instead of glFragColor
    // gl_FragDepth = gl_FragCoord.z; // [0, 1]
    glFragColor = vec4(gl_FragCoord.zzz, 1.0);
}
