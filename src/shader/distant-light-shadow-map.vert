#version 300 es

in vec4 a_position;

uniform mat4 u_mat4_op_w2l_transform;

void main() {
    gl_Position = u_mat4_op_w2l_transform * a_position;
}
