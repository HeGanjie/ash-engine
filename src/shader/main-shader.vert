#version 300 es

precision mediump float;
precision mediump int;

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

in vec4 a_position;
in vec3 a_normal;
in vec3 a_color;

uniform mat4 u_mat4_pp_w2c_transform;
uniform mat4 u_mat4_transform;
uniform mat4 u_mat4_w2c_rot_inv_T;
uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];
uniform PointLight u_pointLights[NUM_POINT_LIGHT];

out vec3 v_normal;
out vec3 v_color;
out vec3 v_fragWorldPos;
out vec4 v_shadowMapPosArr[NUM_SHADOW_MAPS];

void main() {
    gl_Position = u_mat4_pp_w2c_transform * a_position;
    v_fragWorldPos = (u_mat4_transform * a_position).xyz;
    v_color = a_color;

    // 将法向量传到片断着色器
    v_normal = mat3(u_mat4_w2c_rot_inv_T) * a_normal;

    for (int i = 0; i < NUM_DISTANT_LIGHT; i++) {
        v_shadowMapPosArr[i] = u_distantLights[i].op_w2l_transform * a_position;
    }
    for (int i = NUM_DISTANT_LIGHT; i < NUM_LIGHTS; i++) {
        int pointLightIdx = i - NUM_DISTANT_LIGHT,
            shadowMapIdx = NUM_DISTANT_LIGHT + pointLightIdx * 6;
        mat4[] proj_w2l_transform = u_pointLights[pointLightIdx].proj_w2l_transform;
        v_shadowMapPosArr[shadowMapIdx    ] = proj_w2l_transform[0] * a_position;
        v_shadowMapPosArr[shadowMapIdx + 1] = proj_w2l_transform[1] * a_position;
        v_shadowMapPosArr[shadowMapIdx + 2] = proj_w2l_transform[2] * a_position;
        v_shadowMapPosArr[shadowMapIdx + 3] = proj_w2l_transform[3] * a_position;
        v_shadowMapPosArr[shadowMapIdx + 4] = proj_w2l_transform[4] * a_position;
        v_shadowMapPosArr[shadowMapIdx + 5] = proj_w2l_transform[5] * a_position;
    }
}
