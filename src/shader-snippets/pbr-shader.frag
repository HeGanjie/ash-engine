#version 300 es

precision mediump float;
precision mediump sampler2DArray;

#define M_PI 3.141592653589793

#pragma glslify: DistantLight = require(./src/shader-snippets/distant-light.glsl)
#pragma glslify: PointLight = require(./src/shader-snippets/point-light.glsl)
// https://www.scratchapixel.com/lessons/3d-basic-rendering/introduction-to-shading/diffuse-lambertian-shading
// lambert: max(0.0, dot(lightDirection, surfaceNormal));
#pragma glslify: lambert = require(glsl-diffuse-lambert)

// float cookTorrance(vec3 lightDir, vec3 eyeDir, vec3 normal, float roughness, vec3 F0)
#pragma glslify: cookTorrance = require(./src/shader-snippets/cook-torrance.glsl)

#pragma glslify: toLinear = require('glsl-gamma/in')
#pragma glslify: toGamma  = require('glsl-gamma/out')

#if NUM_DISTANT_LIGHT != 0
uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
#endif
#if NUM_POINT_LIGHT != 0
uniform PointLight u_pointLights[NUM_POINT_LIGHT];
#endif
uniform vec3 u_cameraPos;
// https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_2d_array.html
uniform sampler2DArray u_texShadowMapArr;
uniform sampler2D u_mainTexture;

in mat3 v_TBN;
in vec2 v_albedo_texcoord;
in vec2 v_normal_texcoord;
in vec2 v_metallic_texcoord;
in vec2 v_roughness_texcoord;
in vec2 v_ambientOcclusion_texcoord;
in vec3 v_fragWorldPos;
#if NUM_POINT_LIGHT + NUM_DISTANT_LIGHT != 0
in vec4 v_shadowMapPosArr[NUM_SHADOW_MAPS]; // xy -> uv, z -> depth
#endif

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

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

void main() {
    vec3 albedo = toLinear(texture(u_mainTexture, v_albedo_texcoord).rgb);
    vec3 normalMapPointColor = normalize(texture(u_mainTexture, v_normal_texcoord).rgb * 2.0 - 1.0);
    float metallic = texture(u_mainTexture, v_metallic_texcoord).r;
    float roughness = texture(u_mainTexture, v_roughness_texcoord).r;
    float ambientOcclusion = texture(u_mainTexture, v_ambientOcclusion_texcoord).r;

    vec3 ambient = vec3(0.03) * albedo * ambientOcclusion;
    glFragColor = vec4(ambient, 1);

    vec3 normal = normalize(v_TBN * normalMapPointColor); // TODO move to vertex shader
    vec3 viewDir = normalize(u_cameraPos - v_fragWorldPos);

    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    #if NUM_DISTANT_LIGHT != 0
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

        vec3 diffuse = albedo / M_PI;

        vec3 specular = cookTorrance(-u_distantLight.direction, viewDir, normal, roughness, F0);

        vec3 H = normalize(viewDir + -u_distantLight.direction);
        vec3 F = fresnelSchlick(max(dot(H, viewDir), 0.0), F0);
        vec3 kS = F;
        vec3 kD = (1.0 - kS) * (1.0 - metallic);

        glFragColor.rgb += illuminated
            * u_distantLight.intensity
            * u_distantLight.color
            * lambert(-u_distantLight.direction, normal)
            * (kD * diffuse + specular);
    }
    #endif

    #if NUM_POINT_LIGHT != 0
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

        vec3 diffuse = albedo / M_PI;

        vec3 specular = cookTorrance(normalize(-lightDir), viewDir, normal, roughness, F0);

        vec3 H = normalize(viewDir + normalize(-lightDir));
        vec3 F = fresnelSchlick(max(dot(H, viewDir), 0.0), F0);
        vec3 kS = F;
        vec3 kD = (1.0 - kS) * (1.0 - metallic);

        glFragColor.rgb += illuminated
            * u_pointLight.intensity
            * u_pointLight.color
            * attenuation
            * lambert(normalize(-lightDir), normal)
            * (kD * diffuse + specular);
    }
    #endif

    // prevent color bigger than 1
    vec3 ldr = 1.0 - exp(-glFragColor.rgb * 1.0);
    glFragColor.rgb = toGamma(ldr);
}
