#version 300 es

in vec4 a_position;
in int a_layout;

uniform mat4 u_mat4_proj_w2l_transform[NUM_TEXTURES];

flat out int v_layout;
// gl_Position 用于调试，不调试时与 glPositionArr[0] 一样

void main() {
    gl_Position = u_mat4_proj_w2l_transform[a_layout] * a_position; // debug image
    v_layout = a_layout;
}
