#version 300 es
precision mediump float;
precision mediump int;

#define M_PI 3.141592653589793
#define P_RR 0.8

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
uniform sampler2D u_prevResult;
uniform int u_renderCount;
uniform float u_time;


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

highp float rand_2to1(vec2 uv) {
    // 0 - 1
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot( uv, vec2( a,b ) ), sn = mod( dt, M_PI );
    return fract(sin(sn) * c);
}

float cnt;
highp float rand() {
    float pos = gl_FragCoord.x + gl_FragCoord.y * 1920.0 + gl_FragCoord.z;

    cnt += 1.0;
    highp vec2 seed = vec2(fract(sin(u_time + cnt) * 100000.0), fract(sin(pos + cnt) * 100000.0));// TODO 简化？
    return rand_2to1(seed);
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
            if (1.0 <= a + b) {
                a = 1.0 - a;
                b = 1.0 - b;
            }
            return v0 + a * (v1 - v0) + b * (v2 - v0);
        }
    }
    return vec3(0.0);
}

vec3 toWorld(vec3 local, vec3 N) {
    vec3 Nt = abs(N.x) > abs(N.y)
        ? vec3(N.z, 0.0, -N.x) / sqrt(N.x * N.x + N.z * N.z)
        : vec3(0.0, -N.z, N.y) / sqrt(N.y * N.y + N.z * N.z);

    vec3 Nb = cross(N, Nt);
    return local.x * Nb + local.y * N + local.z * Nt;
}

vec3 sampleHalfHemisphere(vec3 wo, vec3 N) {
    float r1 = rand(), r2 = rand();
    // cos(theta) = r1 = y
    // cos^2(theta) + sin^2(theta) = 1 -> sin(theta) = srtf(1 - cos^2(theta))
    float sinTheta = sqrt(1.0 - r1 * r1);
    float phi = 2.0 * M_PI * r2;
    float x = sinTheta * cos(phi);
    float z = sinTheta * sin(phi);
    vec3 local = vec3(x, r1, z);

    return toWorld(local, N);
}

vec3 lambertBRDF(vec3 wi, vec3 wo, vec3 N, vec3 kd) {
    // lambert 漫反射
    return step(0.0, dot(wo, N)) * kd / M_PI;
}

// 计算 P 点往 wo 方向发出了多少光
vec3 castRay(Ray ray) {
    vec3 acc = vec3(0.0, 0.0, 0.0);
    vec3 scale = vec3(1.0, 1.0, 1.0);
    // A + b * x
    // A + b * (C + d * x) -> A+bC + bd*x
    // A + b * (C + d * (E + f * x)) -> A + bC + b*(d * (E + f * x)) -> A+bC+bdE + bdf*x
    // ...

    int cnt = 21;// 避免死循环
    while (cnt-- > 0) {
        // 判断光是否与模型相交
        Intersection camRayIsect = sceneIntersect(ray);
        int nearestFaceIdx = camRayIsect.nearestFaceIdx;

        if (-1 == nearestFaceIdx) {
//          return vec3(0.0, 0.0, 0.0);
            break;
        }
        // 如果是光源，则直接显示灯光颜色
        int materialIdx = u_face_material_ids[nearestFaceIdx];
        vec3 emit = u_material_emits[materialIdx];
        if (0.0 < emit.x) {
//          return emit;
            acc += scale * emit;
            break;
        }

        // 计算直接光照
        vec3 lDir;
        vec3 P = ray.origin + ray.direct * camRayIsect.nearestTUV.x;
        vec3 wo = -ray.direct;
        vec3 N = u_face_normals[nearestFaceIdx];

        vec3 EP = sampleLight(); // 在光源上采样点
        vec3 shadowRayOrigin = P + N * 0.0003;
        Ray shadowRay = Ray(shadowRayOrigin, normalize(EP - shadowRayOrigin));
        Intersection shadowRayIsect = sceneIntersect(shadowRay);

        if (0 <= shadowRayIsect.nearestFaceIdx) {
            // 如果直接碰到光源，则计算 brdf
            int maskMaterialIdx = u_face_material_ids[shadowRayIsect.nearestFaceIdx];
            vec3 emit = u_material_emits[maskMaterialIdx];

            if (0.0 < emit.r) {
                vec3 wsPreNorm = EP - P;
                vec3 ws = normalize(wsPreNorm);
                vec3 kd = u_material_colors[materialIdx];
                vec3 brdf = lambertBRDF(ws, wo, N, kd);
                float wsDotN = dot(ws, N);
                vec3 Ns = u_face_normals[shadowRayIsect.nearestFaceIdx];
                float negWsDotNs = dot(-ws, Ns);
                float d = dot(wsPreNorm, wsPreNorm);
                float pdfOfLight = 1.0 / u_areaOfLightSum;

                // L_dir = L_i * f_r * cos_theta * cos_theta_x / |x-p|^2 / pdf_light
                lDir = emit * brdf * max(0.0, wsDotN) * max(0.0, negWsDotNs) / d / pdfOfLight;
            }
        }

        acc += scale * lDir;

        // 计算间接光照，需要 RR
        float pRR = rand();
        if (P_RR < pRR) {
//          return lDir;
            break;
        }
        vec3 pwi = sampleHalfHemisphere(wo, N); // p 点输入光线的立体角
        Ray ray2 = Ray(shadowRayOrigin , pwi); // secondary ray
        Intersection ray2Isect = sceneIntersect(ray2);

        if (ray2Isect.nearestFaceIdx == -1 || 0.0 < u_material_emits[u_face_material_ids[ray2Isect.nearestFaceIdx]].r) {
//          return lDir;
            break;
        }

        // L_indir = shade(q, wi) * eval(wo, wi, N) * dot(wi, N) / pdf(wo, wi, N) / RussianRoulette
        vec3 kd = u_material_colors[materialIdx];
        float pdf = 0.5 / M_PI;

        vec3 nextScale = lambertBRDF(pwi, wo, N, kd) * max(0.0, dot(pwi, N)) / pdf / P_RR;
//      vec3 lInDir = castRay(ray2) * lambertBRDF(wi, wo, N, kd) * max(0.0, dot(wi, N)) / pdf / P_RR;
        ray = ray2;
        scale *= nextScale;
    }
//  return lDir + lInDir;
    return acc;
}

/*vec3 castRay_t(Ray r, vec3 acc, float scale) { // primary ray, vec3(0.0), 1.0
    // A + b * x
    // A + b * (C + d * x) -> A+bC + bd*x
    // A + b * (C + d * (E + f * x)) -> A + bC + b*(d * (E + f * x)) -> A+bC+bdE + bdf*x
    // ...

    vec3 lDir = vec3(0.05);

    float pRR = rand();
    if (pRR < P_RR) {
        return acc + scale * lDir;
    }
    Ray r2;

    float nextScale = 0.1;
//    return lDir + castRay_t(r2) * nextScale;
    return castRay_t(r2, acc + scale * lDir, scale * nextScale);
}

vec3 castRayLoop(Ray r) { // primary ray, vec3(0.0), 1.0
    Ray currRay = r;
    vec3 acc = vec3(0.0);
    float scale = 1.0;
    // A + b * x
    // A + b * (C + d * x) -> A+bC + bd*x
    // A + b * (C + d * (E + f * x)) -> A + bC + b*(d * (E + f * x)) -> A+bC+bdE + bdf*x
    // ...

    while(true) {
        vec3 lDir = vec3(0.05);

        acc += scale * lDir;

        float pRR = rand();
        if (pRR < P_RR) {
            break;
        }
        Ray r2;
        float nextScale = 0.1;

        currRay = r2;
        scale *= nextScale;
    }

    return acc;
}*/

void main() {
    // 渲染背景色
    glFragColor = vec4(0.0, 0.0, 0.0, 1.0);

    Ray primaryRay = Ray(u_eye_pos, normalize(v_pos_world - u_eye_pos));
    glFragColor.rgb = castRay(primaryRay);

    // https://zhuanlan.zhihu.com/p/58692781 滤波算法：Sn = Sn-1 * (n-1)/n + Cn / n
    if (u_renderCount != 0) {
        vec4 prevPixelColor = texelFetch(u_prevResult, ivec2(gl_FragCoord.xy), 0);
        glFragColor.rgb = (prevPixelColor.rgb * vec3(u_renderCount - 1) + glFragColor.rgb) / vec3(u_renderCount);
    }
}
