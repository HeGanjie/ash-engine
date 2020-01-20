// https://www.scratchapixel.com/lessons/3d-basic-rendering/introduction-to-shading/diffuse-lambertian-shading

// lambert: max(0.0, dot(lightDirection, surfaceNormal));
#pragma glslify: lambert = require(glsl-diffuse-lambert)

float diffuseSurfacePower(float albedoDivPI, float lightIntensity, vec3 lightDirection, vec3 surfaceNormal) {
    return albedoDivPI * lightIntensity * lambert(lightDirection, surfaceNormal);
}

#pragma glslify: export(diffuseSurfacePower)