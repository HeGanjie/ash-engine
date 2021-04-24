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
uniform float u_material_roughness[NUM_MATERIALS_COUNT];
uniform float u_material_metallic[NUM_MATERIALS_COUNT];
uniform int u_material_type[NUM_MATERIALS_COUNT];
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

highp float rand_1to1(highp float x ) {
    // -1 -1
    return fract(sin(x)*10000.0);
}

highp float rand_2to1(vec2 uv) {
    // 0 - 1
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot( uv, vec2( a,b ) ), sn = mod( dt, M_PI );
    return fract(sin(sn) * c);
}

float cnt;
highp float rand() {
    highp float pos = gl_FragCoord.x + gl_FragCoord.y / 1080.0 + gl_FragCoord.z;

    cnt += 1.0;
    return rand_1to1(u_time + pos * 2.618 + cnt);
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

vec3 sampleHalfHemisphere(vec3 wi, vec3 N, int materialIdx) {
    int materialType = u_material_type[materialIdx];

    if (materialType == 0) {
        float r1 = rand(), r2 = rand();
        // cos(theta) = r1 = y
        // cos^2(theta) + sin^2(theta) = 1 -> sin(theta) = srtf(1 - cos^2(theta))
        float sinTheta = sqrt(1.0 - r1 * r1);
        float phi = 2.0 * M_PI * r2;
        float x = sinTheta * cos(phi);
        float z = sinTheta * sin(phi);
        vec3 local = vec3(x, r1, z);

        return toWorld(local, N);
    } else {
        // https://learnopengl-cn.github.io/07%20PBR/03%20IBL/02%20Specular%20IBL/
        float r1 = rand(), r2 = rand();

        float roughness = u_material_roughness[materialIdx];

        float a = roughness*roughness;
        float phi = 2.0 * M_PI * r1;
        float cosTheta = sqrt((1.0 - r2) / (1.0 + (a*a - 1.0) * r2));
        float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

        vec3 H = vec3(cos(phi) * sinTheta, cosTheta, sin(phi) * sinTheta);
        vec3 Hw = toWorld(H, N);
        vec3 L  = normalize(2.0 * dot(wi, Hw) * Hw - wi);
        return L;
    }
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

float DistributionGGX(float NdotH, float roughness) {
    float a      = roughness*roughness;
    float a2     = a*a;
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = M_PI * denom * denom;

    return nom / denom;
}

float GeometrySchlickGGX(float NdotV, float k) {
    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);

    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;
    float ggx2  = GeometrySchlickGGX(NdotV, k);
    float ggx1  = GeometrySchlickGGX(NdotL, k);

    return ggx1 * ggx2;
}

vec3 eval(vec3 wi, vec3 wo, vec3 N, int materialIdx) {
    int materialType = u_material_type[materialIdx];
    vec3 kd = u_material_colors[materialIdx];
    if (materialType == 0) {
        // lambert 漫反射
        return step(0.0, dot(wo, N)) * kd / M_PI;
    } else {
        // pbr https://learnopengl-cn.github.io/07%20PBR/02%20Lighting/
        float cosalpha = dot(N, wo);
        if (cosalpha <= 0.0) {
            return vec3(0.0);
        }
        vec3 diffuse = kd / M_PI;
        vec3 h = normalize(wi + wo);
        float NdotH = max(dot(N, h), 0.0);

        float roughness = u_material_roughness[materialIdx];
        float metallic = u_material_metallic[materialIdx];

        vec3 F0 = mix(vec3(0.04), kd, metallic);
        vec3 F  = fresnelSchlickRoughness(max(dot(h, wo), 0.0), F0, roughness);

        vec3 nominator = DistributionGGX(NdotH, roughness) * GeometrySmith(N, wo, wi, roughness) * F;
        float denominator = 4.0 * max(dot(N, wo), 0.0) * max(dot(N, wi), 0.0) + 0.001;
        vec3 specular = nominator / denominator;

        return (-F + 1.0) * (1.0 - metallic) * diffuse + F * specular;
    }
}

float pdf(vec3 wi, vec3 wo, vec3 N, int materialIdx){
    int materialType = u_material_type[materialIdx];

    if (dot(wo, N) <= 0.0) {
        return 0.0;
    }
    if (materialType == 0) {
        // uniform sample probability 1 / (2 * PI)
        return 0.5 / M_PI;
    } else {
        // https://learnopengl-cn.github.io/07%20PBR/03%20IBL/02%20Specular%20IBL/
        float roughness = u_material_roughness[materialIdx];

        vec3 h = normalize(wi + wo);
        float NdotH = max(dot(N, h), 0.0);
        float HdotV = max(dot(h, wo), 0.0);

        float D   = DistributionGGX(NdotH, roughness);
        return (D * NdotH / (4.0 * HdotV)) + 0.0001;
    }
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
            break;
        }
        // 如果是光源，则直接显示灯光颜色
        int materialIdx = u_face_material_ids[nearestFaceIdx];
        vec3 emit = u_material_emits[materialIdx];
        if (0.0 < emit.x) {
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
                vec3 brdf = eval(ws, wo, N, materialIdx);
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
            break;
        }
        vec3 pwi = sampleHalfHemisphere(wo, N, materialIdx); // p 点输入光线的立体角
        Ray ray2 = Ray(shadowRayOrigin , pwi); // secondary ray
        Intersection ray2Isect = sceneIntersect(ray2);

        if (ray2Isect.nearestFaceIdx == -1 || 0.0 < u_material_emits[u_face_material_ids[ray2Isect.nearestFaceIdx]].r) {
            break;
        }

        // L_indir = shade(q, wi) * eval(wo, wi, N) * dot(wi, N) / pdf(wo, wi, N) / RussianRoulette
        float pdfVal = pdf(pwi, wo, N, materialIdx);

        vec3 nextScale = eval(pwi, wo, N, materialIdx) * max(0.0, dot(pwi, N)) / pdfVal / P_RR;
        ray = ray2;
        scale *= nextScale;
    }
    return acc;
}


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
