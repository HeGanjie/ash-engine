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
in vec3 v_shadowMapPosArr[NUM_SHADOW_MAPS]; // xy -> uv, z -> depth

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
        vec4 shadowMapColor = texture(u_texShadowMapArr, vec3(v_texcoord, i));
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

    for (int i = NUM_DISTANT_LIGHT; i < NUM_LIGHTS; i++) {
        int pointLightIdx = i - NUM_DISTANT_LIGHT, shadowMapIdx = NUM_DISTANT_LIGHT + pointLightIdx * 6;

        PointLight u_pointLight = u_pointLights[pointLightIdx];
        for (int j = 0; j < 6; j++) {
            vec3 v_shadowMapPos = v_shadowMapPosArr[shadowMapIdx + j];

            vec2 v_texcoord = v_shadowMapPos.xy * 0.5 + 0.5; // [-1. 1] => [0, 1]
            vec4 shadowMapColor = texture(u_texShadowMapArr, vec3(v_texcoord, shadowMapIdx + j));
            float depthInLightSpace = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
            float depthCalc = v_shadowMapPos.z;
            float illuminated = step(depthCalc, depthInLightSpace + 0.001); // depthCalc <= depthInLightSpace + 0.001 ? 1 : 0

            vec3 lightDir = u_pointLight.position - gl_FragCoord.xyz;
            float distance = length(lightDir) / 25.0;
            glFragColor.rgb += 1.0 // illuminated
                * u_albedoDivPI
                * u_pointLight.intensity
                * max(0.0, dot(normal, normalize(lightDir)))
                * v_color
                * u_pointLight.color / (4.0 * M_PI * distance * distance);
        }
    }
}
