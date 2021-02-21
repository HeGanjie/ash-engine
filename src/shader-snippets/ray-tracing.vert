#version 300 es

precision mediump float;

in vec2 a_position;

uniform vec2 u_resolution;
uniform float u_fov;
uniform mat4 u_cam_to_world;

out vec3 v_pos_world;

void main() {
    // 裁剪空间的坐标范围永远是 -1 到 1，https://webglfundamentals.org/webgl/lessons/zh_cn/webgl-fundamentals.html
    gl_Position = vec4(a_position, 0, 1);
    // 假设光栅面板距离眼睛的距离为 1
    float halfHeight = tan(u_fov * 0.5);
    float halfWidth = halfHeight * u_resolution.x / u_resolution.y;
    vec4 vPosCam = vec4(a_position.x * halfWidth, a_position.y * halfHeight, -1.0, 1.0);
    // 安全起见在 fragShader 生成 ray 并进行 normalize
    v_pos_world = (u_cam_to_world * vPosCam).xyz;
}
