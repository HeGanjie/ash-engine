#version 300 es
precision mediump float;
precision mediump int;

#define M_PI 3.141592653589793

in vec3 v_pos_world;

uniform vec2 u_resolution;
uniform vec3 u_eye_pos;
// 模型信息
uniform vec3 u_vertices[NUM_VERTICES_COUNT];
uniform ivec3 u_indices[NUM_FACES_COUNT];
uniform vec3 u_face_normals[NUM_FACES_COUNT];
uniform int u_face_material_ids[NUM_FACES_COUNT];
uniform mat4 u_local_to_world_matrixs[NUM_MESHES_COUNT];
uniform vec3 u_material_colors[NUM_MATERIALS_COUNT];
uniform vec3 u_material_emits[NUM_MATERIALS_COUNT];
uniform int u_lightFaceIdx[NUM_LIGHT_FACE_COUNT];
uniform float u_areaOfLightFace[NUM_LIGHT_FACE_COUNT];
uniform float u_areaOfLightSum;
uniform vec2 ran;

out vec4 glFragColor;


struct Ray {
    vec3 origin;
    vec3 direct;
};

struct Intersection {
    Ray ray;
    vec3 nearestTUV;
    int nearestFaceIdx;
};

vec2 seed;
float rand() {
    seed -= vec2(ran.x * ran.y);
    return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
}

// https://www.shadertoy.com/view/MlGcDz
// Triangle intersection. Returns { t, u, v }
vec3 triIntersect( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 ) {
    vec3 v1v0 = v1 - v0;
    vec3 v2v0 = v2 - v0;
    vec3 rov0 = ro - v0;

    vec3  n = cross( v1v0, v2v0 );
    vec3  q = cross( rov0, rd );
    float d = 1.0/dot( rd, n );
    float u = d*dot( -q, v2v0 );
    float v = d*dot(  q, v1v0 );
    float t = d*dot( -n, rov0 );

    if( u<0.0 || v<0.0 || (u+v)>1.0 ) t = -1.0;
    return vec3( t, u, v );
}

// TODO 实现 bvh
Intersection sceneIntersect(Ray ray) {
    // 判断光是否与模型相交
    vec3 nearestTUV = vec3(1e10, 0.0, 0.0);
    int nearestFaceIdx = -1;
    for (int faceIdx = 0; faceIdx < NUM_FACES_COUNT; faceIdx++) {
        // 读出三角形
        ivec3 indices = u_indices[faceIdx];
        vec3 v0 = u_vertices[indices.x];
        vec3 v1 = u_vertices[indices.y];
        vec3 v2 = u_vertices[indices.z];

        // 相交测试，找到最近的三角形
        vec3 tuv = triIntersect(ray.origin, ray.direct, v0, v1, v2);
        if (0.0 < tuv.x && tuv.x < nearestTUV.x) {
            nearestTUV = tuv;
            nearestFaceIdx = faceIdx;
        }
    }
    Intersection isect;
    isect.ray = ray;
    isect.nearestTUV = nearestTUV;
    isect.nearestFaceIdx = nearestFaceIdx;
    return isect;
}

vec3 sampleLight() {
    float p = rand(), pA = p * u_areaOfLightSum, pickingArea = 0.0;
    for (int lightFaceReadIdx = 0; lightFaceReadIdx < NUM_LIGHT_FACE_COUNT; lightFaceReadIdx++) {
        pickingArea += u_areaOfLightFace[lightFaceReadIdx];
        if (pA <= pickingArea){
            int lightFaceIdx = u_lightFaceIdx[lightFaceReadIdx];

            ivec3 indices = u_indices[lightFaceIdx];
            vec3 v0 = u_vertices[indices.x];
            vec3 v1 = u_vertices[indices.y];
            vec3 v2 = u_vertices[indices.z];
            float a = rand(), b = rand();
            // TODO optimise
            return v0 + a * (v1 - v0) + b * (v2 - v0);
        }
    }
    return vec3(0.0);
}

void main() {
    // 渲染背景色
    glFragColor = vec4(0.0, 0.0, 0.0, 1.0);

    Ray ray = Ray(u_eye_pos, normalize(v_pos_world - u_eye_pos));
    // 判断光是否与模型相交
    Intersection camRayIsect = sceneIntersect(ray);
    vec3 nearestTUV = camRayIsect.nearestTUV;
    int nearestFaceIdx = camRayIsect.nearestFaceIdx;

    if (-1 == nearestFaceIdx) {
        return;
    }
    // 如果是光源，则直接显示灯光颜色
    int materialIdx = u_face_material_ids[nearestFaceIdx];
    vec3 emit = u_material_emits[materialIdx];
    if (0.0 < emit.x) {
        glFragColor.rgb += emit;
        return;
    }

    // 计算直接光照
    vec3 P = ray.origin + ray.direct * camRayIsect.nearestTUV.x;
    vec3 faceNormal = u_face_normals[nearestFaceIdx];
    vec3 EP = sampleLight(); // 在光源上采样点
    vec3 shadowRayOrigin = P + faceNormal * 0.0001;
    Ray shadowRay = Ray(shadowRayOrigin, normalize(EP - shadowRayOrigin));
    Intersection shadowRayIsect = sceneIntersect(shadowRay);

    if (0 <= shadowRayIsect.nearestFaceIdx) {
        // 如果直接碰到光源，则计算 brdf
        int maskMaterialIdx = u_face_material_ids[shadowRayIsect.nearestFaceIdx];
        vec3 emit = u_material_emits[maskMaterialIdx];

        if (0.0 < emit.r) {
            vec3 wsPreNorm = EP - P;
            vec3 ws = normalize(wsPreNorm);
            vec3 wo = -ray.direct;
            vec3 N = u_face_normals[nearestFaceIdx];
            vec3 kd = u_material_colors[materialIdx];
            vec3 brdf = step(0.0, dot(wo, N)) * kd / M_PI;
            float wsDotN = dot(ws, N);
            vec3 Ns = u_face_normals[shadowRayIsect.nearestFaceIdx];
            float negWsDotNs = dot(-ws, Ns);
            float d = dot(wsPreNorm, wsPreNorm);
            float pdfOfLight = 1.0 / u_areaOfLightSum;

            // L_dir = L_i * f_r * cos_theta * cos_theta_x / |x-p|^2 / pdf_light
            vec3 lDir = emit * brdf * max(0.0, wsDotN) * max(0.0, negWsDotNs) / d / pdfOfLight;
            glFragColor.rgb += lDir;
        }
    }

    // TODO 计算间接光照，需要 RR

    //    float depth = nearestTUV.x / 1500.0;
    //    glFragColor.rgb += depth;
}
