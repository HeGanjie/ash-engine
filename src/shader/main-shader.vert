attribute vec4 a_position;
uniform mat4 u_matrix;
uniform mat4 u_shadowMapMatrix;
attribute vec3 a_normal;
uniform mat4 u_normalTransform;

varying vec3 v_normal;
varying vec3 v_shadowMapPos;

void main() {
    gl_Position = u_matrix * a_position;
    v_shadowMapPos = vec3(u_shadowMapMatrix * a_position);
    // 将法向量传到片断着色器
    v_normal = mat3(u_normalTransform) * a_normal;
}
