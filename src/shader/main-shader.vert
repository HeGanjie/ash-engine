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

in vec4 a_position;
in vec3 a_normal;
in vec3 a_color;

uniform mat4 u_mat4_pp_w2c_transform;
uniform mat4 u_mat4_w2c_rot_inv_T;
uniform DistantLight u_distantLights[NUM_DISTANT_LIGHT];

out vec3 v_normal;
out vec3 v_color;
out vec3 v_shadowMapPosArr[NUM_DISTANT_LIGHT];

void main() {
    gl_Position = u_mat4_pp_w2c_transform * a_position;
    v_color = a_color;

    // 将法向量传到片断着色器
    v_normal = mat3(u_mat4_w2c_rot_inv_T) * a_normal;

    for (int i = 0; i < NUM_DISTANT_LIGHT; i++) {
        v_shadowMapPosArr[i] = vec3(u_distantLights[i].op_w2l_transform * a_position);
    }
}
