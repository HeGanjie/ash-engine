precision mediump float;
varying vec3 v_normal;
uniform vec3 u_reverseLightDirection;

varying vec3 v_shadowMapPos; // xy -> uv, z -> depth
uniform sampler2D u_texShadowMap;

void main() {
    vec2 v_texcoord = v_shadowMapPos.xy * 0.5 + 0.5;
    vec4 shadowMapColor = texture2D(u_texShadowMap, v_texcoord);
    float depthInLightSpace = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
    float depthCalc = v_shadowMapPos.z;
    float illuminated = step(depthCalc, depthInLightSpace + 0.001); // depthCalc <= depthInLightSpace + 0.001 ? 1 : 0

    // 由于 v_normal 是插值出来的，和有可能不是单位向量，
    // 可以用 normalize 将其单位化。
    vec3 normal = normalize(v_normal);
    float light = dot(normal, u_reverseLightDirection);
    gl_FragColor = vec4(1, 1, 1, 1);
    // 将颜色部分（不包括 alpha）和 光照相乘
    gl_FragColor.rgb *= light * illuminated;
}
