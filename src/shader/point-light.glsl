struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
    mat4 proj_w2l_transform[6];
};

#pragma glslify: export(PointLight)
