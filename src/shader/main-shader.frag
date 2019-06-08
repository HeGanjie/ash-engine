#version 300 es

precision mediump float;
precision mediump sampler2DArray;

#define M_PI 3.141592653589793

struct DistantLight {
    vec3 direction;
    vec3 color;
    float intensity;
    mat4 op_w2l_transform;
    vec3 reverseLightDirection;
};

struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
    mat4 proj_w2l_transform[6];
};

uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
uniform PointLight u_pointLights[NUM_POINT_LIGHT];
uniform float u_albedoDivPI;
// https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_2d_array.html
uniform sampler2DArray u_texShadowMapArr;

in vec3 v_normal;
in vec3 v_color;
in vec3 v_fragWorldPos;
in vec4 v_shadowMapPosArr[NUM_SHADOW_MAPS]; // xy -> uv, z -> depth

out vec4 glFragColor;

void main() {
    glFragColor = vec4(0, 0, 0, 1);
//    glFragColor = vec4(0.1, 0.1, 0.1, 1); // ambient

    // 由于 v_normal 是插值出来的，和有可能不是单位向量，可以用 normalize 将其单位化。
    vec3 normal = normalize(v_normal);

    for (int i = 0; i < NUM_DISTANT_LIGHT; i++) {
        DistantLight u_distantLight = u_distantLights[i];
        vec4 v_shadowMapPos = v_shadowMapPosArr[i];
        vec3 projPos = v_shadowMapPos.xyz / v_shadowMapPos.w;

        vec2 v_texcoord = projPos.xy * 0.5 + 0.5; // [-1. 1] => [0, 1]
        vec4 shadowMapColor = texture(u_texShadowMapArr, vec3(v_texcoord, i));
        // shadowMapColor.r  [0, 1]
        float minDepth = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
        // v_shadowMapPos.z  [-1, 1] -> [0, 1]
        float depthOfFrag = projPos.z * 0.5 + 0.5;
        float illuminated = step(depthOfFrag, minDepth + 0.015); // depthOfFrag <= minDepth + 0.01 ? 1 : 0

        glFragColor.rgb += illuminated
            * u_albedoDivPI
            * u_distantLight.intensity
            * max(0.0, dot(normal, u_distantLight.reverseLightDirection))
            * v_color
            * u_distantLight.color;
    }

    for (int i = NUM_DISTANT_LIGHT; i < NUM_LIGHTS; i++) {
        int pointLightIdx = i - NUM_DISTANT_LIGHT, shadowMapIdx = NUM_DISTANT_LIGHT + pointLightIdx * 6;

        PointLight u_pointLight = u_pointLights[pointLightIdx];
        for (int j = 0; j < 6; j++) {
            vec4 v_shadowMapPos = v_shadowMapPosArr[shadowMapIdx + j];
            vec3 projPos = v_shadowMapPos.xyz / v_shadowMapPos.w;

            float pX = projPos.x, pY = projPos.y, pZ = projPos.z;
            if (pX < -1.0 || 1.0 < pX || pY < -1.0 || 1.0 < pY || pZ < -1.0 || 1.0 < pZ) {
                continue;
            }

            vec2 v_texcoord = projPos.xy * 0.5 + 0.5; // [-1. 1] => [0, 1]
            vec4 shadowMapColor = texture(u_texShadowMapArr, vec3(v_texcoord, shadowMapIdx + j));
            // shadowMapColor.r  [0, 1]
            float minDepth = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
            // v_shadowMapPos.z  [-1, 1] -> [0, 1]
            float depthOfFrag = projPos.z * 0.5 + 0.5;
            float illuminated = step(depthOfFrag, minDepth + 0.015); // depthOfFrag <= minDepth + 0.001 ? 1 : 0

            vec3 lightDir = u_pointLight.position - v_fragWorldPos;
            float distance = length(lightDir);
            glFragColor.rgb += illuminated
                * u_albedoDivPI
                * u_pointLight.intensity
                * max(0.0, dot(normal, normalize(lightDir)))
                * v_color
                * u_pointLight.color / (4.0 * M_PI * distance * distance);
        }
    }
}
