#version 300 es
precision mediump float;

in vec3 v_pos_world;

uniform vec2 u_resolution;
uniform vec3 u_eye_pos;

out vec4 glFragColor;

struct Ray {
    vec3 origin;
    vec3 direct;
    float t;
    bool isHit;
};

void main() {
//    Ray r0 = Ray(u_eye_pos, normalize(v_pos_world - u_eye_pos));
    vec2 st = gl_FragCoord.xy / u_resolution;
    glFragColor = vec4(st.x, st.y, 0.0, 1.0);
}
