#version 300 es

precision mediump float;
precision mediump sampler2DArray;

#define M_PI 3.141592653589793

#pragma glslify: DistantLight = require(./src/shader/distant-light.glsl)
#pragma glslify: PointLight = require(./src/shader/point-light.glsl)
#pragma glslify: diffuseSurfacePower = require(./src/shader/diffuse-surface-power.glsl)
// float phong(vec3 lightDir, vec3 eyeDir, vec3 normal, float shininess)
#pragma glslify: phong = require(glsl-specular-phong)

uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
uniform PointLight u_pointLights[NUM_POINT_LIGHT];
uniform float u_albedoDivPI;
uniform float u_kd;
uniform float u_ks;
uniform float u_specularExp;
uniform vec3 u_cameraPos;
// https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_2d_array.html
uniform sampler2DArray u_texShadowMapArr;
uniform sampler2D u_mainTexture;

in mat3 v_TBN;
in vec2 v_diffuse_texcoord;
in vec2 v_specular_texcoord;
in vec2 v_normal_texcoord;
in vec3 v_fragWorldPos;
in vec4 v_shadowMapPosArr[NUM_SHADOW_MAPS]; // xy -> uv, z -> depth

out vec4 glFragColor;

int lookupCubeFace(vec3 v) {
    vec3 vAbs = abs(v);
    if (vAbs.z >= vAbs.x && vAbs.z >= vAbs.y) {
        return v.z < 0.0 ? 5 : 4;
    }
    if (vAbs.y >= vAbs.x) {
        return v.y < 0.0 ? 3 : 2;
    }
    return v.x < 0.0 ? 1 : 0;
}

void main() {
    vec3 pointColor = texture(u_mainTexture, v_diffuse_texcoord).rgb;
    float pointSpecularColor = texture(u_mainTexture, v_specular_texcoord).r;
    vec3 normalMapPointColor = normalize(texture(u_mainTexture, v_normal_texcoord).rgb * 2.0 - 1.0);

    glFragColor = vec4(0, 0, 0, 1);
//  glFragColor = vec4(0.1, 0.1, 0.1, 1); // ambient

    vec3 normal = normalize(v_TBN * normalMapPointColor); // TODO move to vertex shader
    vec3 viewDir = normalize(v_fragWorldPos - u_cameraPos);

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

        vec3 diffuse = illuminated
            * diffuseSurfacePower(u_albedoDivPI, u_distantLight.intensity, u_distantLight.reverseLightDirection, normal)
            * pointColor
            * u_distantLight.color;

        float specular = illuminated
            * u_distantLight.intensity
            * pointSpecularColor
            * phong(u_distantLight.direction, viewDir, normal, u_specularExp);

        glFragColor.rgb += u_kd * diffuse + u_ks * specular;
    }

    for (int i = NUM_DISTANT_LIGHT; i < NUM_LIGHTS; i++) {
        int pointLightIdx = i - NUM_DISTANT_LIGHT, shadowMapIdx = NUM_DISTANT_LIGHT + pointLightIdx * 6;

        PointLight u_pointLight = u_pointLights[pointLightIdx];
        vec3 lightDir = v_fragWorldPos - u_pointLight.position;
        int faceIdx = lookupCubeFace(lightDir);

        vec4 v_shadowMapPos = v_shadowMapPosArr[shadowMapIdx + faceIdx];
        vec3 projPos = v_shadowMapPos.xyz / v_shadowMapPos.w;

        vec2 v_texcoord = projPos.xy * 0.5 + 0.5; // [-1. 1] => [0, 1]
        vec4 shadowMapColor = texture(u_texShadowMapArr, vec3(v_texcoord, shadowMapIdx + faceIdx));
        // shadowMapColor.r  [0, 1]
        float minDepth = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
        // v_shadowMapPos.z  [-1, 1] -> [0, 1]
        float depthOfFrag = projPos.z * 0.5 + 0.5;
        float illuminated = step(depthOfFrag, minDepth + 0.015); // depthOfFrag <= minDepth + 0.001 ? 1 : 0

        float distance = length(lightDir);
        float attenuation = 1.0 / (4.0 * M_PI * distance * distance);
        vec3 diffuse = illuminated
            * diffuseSurfacePower(u_albedoDivPI, u_pointLight.intensity, normalize(-lightDir), normal)
            * pointColor
            * u_pointLight.color
            * attenuation;

        float specular = illuminated
            * u_pointLight.intensity
            * pointSpecularColor
            * phong(normalize(lightDir), viewDir, normal, u_specularExp)
            * attenuation;

        glFragColor.rgb += u_kd * diffuse + u_ks * specular;
    }
}
