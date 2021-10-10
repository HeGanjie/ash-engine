#version 300 es
precision mediump float;
precision mediump int;

uniform sampler2D u_offScreenTexture;
uniform float u_exposure;

out vec4 glFragColor;

void main() {
    vec3 color = texelFetch(u_offScreenTexture, ivec2(gl_FragCoord.xy), 0).xyz;
    // 色调映射
    color = vec3(1.0) - exp(-color * u_exposure);
    // Gamma 校正
    color = pow(color, vec3(1.0/2.2));

    glFragColor = vec4(color, 1.0);
}
