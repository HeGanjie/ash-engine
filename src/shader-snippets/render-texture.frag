#version 300 es
precision mediump float;
precision mediump int;

uniform sampler2D u_offScreenTexture;

out vec4 glFragColor;

void main() {
    // TODO HDR
    vec4 prevPixelColor = texelFetch(u_offScreenTexture, ivec2(gl_FragCoord.xy), 0);
    glFragColor = vec4(prevPixelColor.xyz, 1.0);
}
