struct DistantLight {
    vec3 direction;
    vec3 color;
    float intensity;
    mat4 op_w2l_transform;
};

#pragma glslify: export(DistantLight)
