attribute vec4 a_position;
attribute vec3 a_normal;

uniform mat4 u_mat4_pp_w2c_transform;
uniform mat4 u_mat4_op_w2l_transform;
uniform mat4 u_mat4_w2c_rot_inv_T;

varying vec3 v_normal;
varying vec3 v_shadowMapPos;

void main() {
    gl_Position = u_mat4_pp_w2c_transform * a_position;
    v_shadowMapPos = vec3(u_mat4_op_w2l_transform * a_position);
    // 将法向量传到片断着色器
    v_normal = mat3(u_mat4_w2c_rot_inv_T) * a_normal;
}
