#version 300 es
precision mediump float;

uniform vec2 u_resolution;

out vec4 glFragColor;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    glFragColor = vec4(st.x, st.y, 0.0, 1.0);
}
