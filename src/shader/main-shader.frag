#version 300 es

precision mediump float;
precision mediump int;

struct DistantLight {
    vec3 direction;
    vec3 color;
    float intensity;
    mat4 op_w2l_transform;
    vec3 reverseLightDirection;
//    int indexOfLights;
};
/*struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
};*/
uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
//uniform PointLight u_pointLights[NUM_POINT_LIGHT];
uniform float u_albedoDivPI;
// TODO use sampler2DArray
// https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_2d_array.html
uniform sampler2D u_texShadowMap;

in vec3 v_normal;
in vec3 v_color;
in vec3 v_shadowMapPosArr[NUM_DISTANT_LIGHT]; // xy -> uv, z -> depth

out vec4 glFragColor;

void main() {
    glFragColor = vec4(0, 0, 0, 1);

    // 由于 v_normal 是插值出来的，和有可能不是单位向量，可以用 normalize 将其单位化。
    vec3 normal = normalize(v_normal);

    for (int i = 0; i < NUM_DISTANT_LIGHT; i++) {
        DistantLight u_distantLight = u_distantLights[i];
        vec3 v_shadowMapPos = v_shadowMapPosArr[i];

        vec2 v_texcoord = v_shadowMapPos.xy * 0.5 + 0.5; // [-1. 1] => [0, 1]
        //sampler2D texShadowMap = u_texShadowMaps[u_distantLight.indexOfLights];
        vec4 shadowMapColor = texture(u_texShadowMap, v_texcoord);
        float depthInLightSpace = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
        float depthCalc = v_shadowMapPos.z;
        float illuminated = step(depthCalc, depthInLightSpace + 0.001); // depthCalc <= depthInLightSpace + 0.001 ? 1 : 0

        glFragColor.rgb += illuminated
            * u_albedoDivPI
            * u_distantLight.intensity
            * max(0.0, dot(normal, u_distantLight.reverseLightDirection))
            * v_color
            * u_distantLight.color;
    }
}
