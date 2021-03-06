#version 300 es

precision mediump float;
precision mediump int;

#pragma glslify: DistantLight = require(./src/shader-snippets/distant-light.glsl)

#pragma glslify: PointLight = require(./src/shader-snippets/point-light.glsl)

in vec4 a_position;
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_diffuse_texcoord;
in vec2 a_specular_texcoord;
in vec2 a_normal_texcoord;

uniform mat4 u_mat4_pp_w2c;
uniform mat4 u_mat4_transform;
uniform mat4 u_mat4_w2c_rot_inv_T;
#if NUM_DISTANT_LIGHT != 0
uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
#endif
#if NUM_POINT_LIGHT != 0
uniform PointLight u_pointLights[NUM_POINT_LIGHT];
#endif

out mat3 v_TBN;
out vec2 v_diffuse_texcoord;
out vec2 v_specular_texcoord;
out vec2 v_normal_texcoord;
out vec3 v_fragWorldPos;
#if NUM_POINT_LIGHT + NUM_DISTANT_LIGHT != 0
out vec4 v_shadowMapPosArr[NUM_SHADOW_MAPS];
#endif

void main() {
    vec4 pTransformed = u_mat4_transform * a_position;
    gl_Position = u_mat4_pp_w2c * pTransformed;
    v_fragWorldPos = pTransformed.xyz;
    v_diffuse_texcoord = a_diffuse_texcoord;
    v_specular_texcoord = a_specular_texcoord;
    v_normal_texcoord = a_normal_texcoord;

    // 将法向量传到片断着色器
    vec3 T = normalize(vec3(u_mat4_w2c_rot_inv_T * vec4(a_tangent, 0.0)));
    vec3 N = normalize(vec3(u_mat4_w2c_rot_inv_T * vec4(a_normal,  0.0)));
    vec3 B = cross(N, T);
    v_TBN = mat3(T, B, N);

    #if NUM_DISTANT_LIGHT != 0
    for (int i = 0; i < NUM_DISTANT_LIGHT; i++) {
        v_shadowMapPosArr[i] = u_distantLights[i].op_w2l_transform * pTransformed;
    }
    #endif

    #if NUM_POINT_LIGHT != 0
    for (int i = NUM_DISTANT_LIGHT; i < NUM_LIGHTS; i++) {
        int pointLightIdx = i - NUM_DISTANT_LIGHT,
            shadowMapIdx = NUM_DISTANT_LIGHT + pointLightIdx * 6;
        mat4[] proj_w2l_transform = u_pointLights[pointLightIdx].proj_w2l_transform;
        v_shadowMapPosArr[shadowMapIdx    ] = proj_w2l_transform[0] * pTransformed;
        v_shadowMapPosArr[shadowMapIdx + 1] = proj_w2l_transform[1] * pTransformed;
        v_shadowMapPosArr[shadowMapIdx + 2] = proj_w2l_transform[2] * pTransformed;
        v_shadowMapPosArr[shadowMapIdx + 3] = proj_w2l_transform[3] * pTransformed;
        v_shadowMapPosArr[shadowMapIdx + 4] = proj_w2l_transform[4] * pTransformed;
        v_shadowMapPosArr[shadowMapIdx + 5] = proj_w2l_transform[5] * pTransformed;
    }
    #endif
}
