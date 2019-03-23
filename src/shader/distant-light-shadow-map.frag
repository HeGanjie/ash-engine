
precision mediump float;

void main() {
    gl_FragColor = vec4(gl_FragCoord.zzz, 1.0);
    // gl_FragDepth = gl_FragCoord.z;
}
