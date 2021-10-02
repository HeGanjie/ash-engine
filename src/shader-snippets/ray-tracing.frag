#version 300 es
precision mediump float;
precision mediump int;

#define M_PI 3.141592653589793
#define P_RR 0.8

in vec3 v_pos_world;

uniform vec2 u_resolution;
uniform vec3 u_eye_pos;

uniform float u_areaOfLightSum;
uniform vec2 ran;
uniform sampler2D u_prevResult;
uniform sampler2D u_data_texture;
uniform int u_data_texture_width;
uniform int u_renderCount;
uniform float u_time;
uniform float u_exposure;

// dataImageMeta: meshCount, meshMetaOffset, bvhNodeCount,bvhNodeOffset；
//                materialCount, materialOffset, emitTriangleCount, emitTriangleOffset；vec4 * 2
// meshMeta: data offset, triangleCount, materialID；vec4 * meshCount
// mesh model mat4; world point * 3；uv * 3；world normal * 3；vec4 * (4 + 9 * n)
// ...
// bvhNode：boundMin；boundMax；leftNodeIdx, rightNodeIdx, child meshIdx, triangleIdx；vec4 * 3 * n
// material：ID，roughness，metallic, type；albedo；emit intensity；vec4 * 3 * n
// emit triangles：triangle area, meshIdx, faceIdx；vec4 * n

out vec4 glFragColor;


struct Ray {
    vec3 origin;
    vec3 direct;
};

struct Intersection {
    Ray ray;
    vec3 nearestTUV;
    int nearestMeshIdx;
    int nearestFaceIdx;
    int faceMaterialIdx;
    vec3 faceNormal;
    bool hitFront;
};

struct MeshInfo {
    int dataOffset;
    int triangleCount;
    int materialId;
};

struct TriangleInfo {
    vec3 A, B, C;
    float area; // 只有采样直接光照时候会用到
//    vec2 uvA, uvB, uvC;
//    vec3 nA, nB, nC;
};

struct MaterialInfo {
    int materialId;
    float roughness;
    float metallic;
    int type;
    vec3 albedo;
    vec3 emitIntensity;
};

vec4 readDataTexture(int offset) {
    return texelFetch(u_data_texture, ivec2(offset % u_data_texture_width, offset / u_data_texture_width), 0);
}

MeshInfo getMeshInfo(int meshIdx) {
    vec4 vals = readDataTexture(2 + meshIdx);
    return MeshInfo(int(vals.x), int(vals.y), int(vals.z));
}

TriangleInfo getTriangleVertices(int meshIdx, int faceIdx) {
    int triangleDataOffset = getMeshInfo(meshIdx).dataOffset + faceIdx * 9 + 4;
    return TriangleInfo(
        readDataTexture(triangleDataOffset).xyz,
        readDataTexture(triangleDataOffset + 1).xyz,
        readDataTexture(triangleDataOffset + 2).xyz,
        0.0
    );
}

TriangleInfo getEmitTriangle(int emitFaceIdx) {
    int emitTriangleOffset = int(readDataTexture(1).w) + emitFaceIdx;
    vec4 emitTriangleInfo = readDataTexture(emitTriangleOffset);
    int meshIdx = int(emitTriangleInfo.y);
    int faceIdx = int(emitTriangleInfo.z);

    TriangleInfo tri = getTriangleVertices(meshIdx, faceIdx);
    tri.area = emitTriangleInfo.x;
    return tri;
}

MaterialInfo getMaterialInfo(int materialId) {
    int materialOffset = int(readDataTexture(1).y) + materialId * 3;
    vec4 materialInfo0 = readDataTexture(materialOffset);

    return MaterialInfo(
        int(materialInfo0.x), materialInfo0.y, materialInfo0.z, int(materialInfo0.w),
        readDataTexture(materialOffset + 1).xyz,
        readDataTexture(materialOffset + 2).xyz
    );
}

vec3 calcFaceNormal(vec3 v0, vec3 v1, vec3 v2) {
    vec3 v01 = v1 - v0;
    vec3 v12 = v2 - v1;
    return normalize(cross(v01, v12));
}

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

float powerHeuristic(float f, float g) {
//    return f / (f + g + 1e-6);
    float fSq = f * f;
    return fSq / (fSq + g * g);
}

// TODO 实现 bvh
Intersection sceneIntersect(Ray ray) {
    // 判断光是否与模型相交
    vec3 nearestTUV = vec3(1e10, 0.0, 0.0);
    int nearestMeshIdx = -1;
    int nearestFaceIdx = -1;
    TriangleInfo nearestTri;
    for (int meshIdx = 0; meshIdx < NUM_MESHES_COUNT; meshIdx++) {
        int triangleCount = getMeshInfo(meshIdx).triangleCount;
        for (int faceIdx = 0; faceIdx < triangleCount; faceIdx++) {
            TriangleInfo tri = getTriangleVertices(meshIdx, faceIdx);

            // 相交测试，找到最近的三角形
            vec3 tuv = triIntersect(ray.origin, ray.direct, tri.A, tri.B, tri.C);
            if (0.0 < tuv.x && tuv.x < nearestTUV.x) {
                nearestTUV = tuv;
                nearestMeshIdx = meshIdx;
                nearestFaceIdx = faceIdx;
                nearestTri = tri;
            }
        }
    }

    Intersection isect;
    isect.ray = ray;
    isect.nearestTUV = nearestTUV;
    isect.nearestMeshIdx = nearestMeshIdx;
    isect.nearestFaceIdx = nearestFaceIdx;
    isect.faceMaterialIdx = nearestMeshIdx == -1 ? -1 : getMeshInfo(nearestMeshIdx).materialId;
    isect.faceNormal = nearestMeshIdx == -1 ? vec3(0.0) : calcFaceNormal(nearestTri.A, nearestTri.B, nearestTri.C);
    isect.hitFront = nearestMeshIdx == -1 ? false : dot(ray.direct, isect.faceNormal) < 0.0;
    return isect;
}

vec3 sampleLight() {
    float p = rand(), pA = p * u_areaOfLightSum, pickingArea = 0.0;
    for (int emitFaceReadIdx = 0; emitFaceReadIdx < NUM_LIGHT_FACE_COUNT; emitFaceReadIdx++) {
        TriangleInfo tri = getEmitTriangle(emitFaceReadIdx);
        pickingArea += tri.area;
        if (pA <= pickingArea){
            vec3 v0 = tri.A;
            vec3 v1 = tri.B;
            vec3 v2 = tri.C;
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

#define TWO_PI 6.283185307
#define INV_PI 0.31830988618

vec3 SampleHemisphereCos(out float pdf) {
    float r0 = rand(), r1 = rand();
    float z = sqrt(1.0 - r0);
    float phi = r1 * TWO_PI;
    float sinTheta = sqrt(r0);
    vec3 dir = vec3(sinTheta * cos(phi), sinTheta * sin(phi), z);
    pdf = z * INV_PI;
    return dir;
}

vec3 sampleHemisphere(vec3 wi, vec3 N, int materialIdx) {
    MaterialInfo material = getMaterialInfo(materialIdx);
    int materialType = material.type;

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

        float roughness = material.roughness;

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
    MaterialInfo material = getMaterialInfo(materialIdx);
    int materialType = material.type;
    vec3 kd = material.albedo;
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

        float roughness = material.roughness;
        float metallic = material.metallic;

        vec3 F0 = mix(vec3(0.04), kd, metallic);
        vec3 F  = fresnelSchlickRoughness(max(dot(h, wo), 0.0), F0, roughness);

        vec3 nominator = DistributionGGX(NdotH, roughness) * GeometrySmith(N, wo, wi, roughness) * F;
        float denominator = 4.0 * max(dot(N, wo), 0.0) * max(dot(N, wi), 0.0) + 0.001;
        vec3 specular = nominator / denominator;

        return (-F + 1.0) * (1.0 - metallic) * diffuse + F * specular;
    }
}

float pdf(vec3 wi, vec3 wo, vec3 N, int materialIdx){
    if (dot(wo, N) <= 0.0) {
        return 0.0;
    }

    MaterialInfo material = getMaterialInfo(materialIdx);
    int materialType = material.type;

    if (materialType == 0) {
        // uniform sample probability 1 / (2 * PI)
        return 0.5 / M_PI;
    } else {
        // https://learnopengl-cn.github.io/07%20PBR/03%20IBL/02%20Specular%20IBL/
        float roughness = material.roughness;

        vec3 h = normalize(wi + wo);
        float NdotH = max(dot(N, h), 0.0);
        float HdotV = max(dot(h, wo), 0.0);

        float D   = DistributionGGX(NdotH, roughness);
        return (D * NdotH / (4.0 * HdotV)) + 0.0001;
    }
}

#define MIS_ON (1==1)

// 递归改循环
// A + b * x
// A + b * (C + d * x) -> A+bC + bd*x
// ...

// NEE MIS 参考 https://zhuanlan.zhihu.com/p/360420413

// 计算 P 点往 wo 方向发出了多少光
vec3 castRay(Ray ray) {
    vec3 acc = vec3(0.0, 0.0, 0.0);
    vec3 scale = vec3(1.0, 1.0, 1.0);
    float LeWeight = 1.0;
    Intersection camRayIsect = sceneIntersect(ray);

    int cnt = 21;// 避免死循环
    while (cnt-- > 0) {
        // 判断光是否与模型相交
        int nearestFaceIdx = camRayIsect.nearestFaceIdx;

        if (-1 == nearestFaceIdx) {
            break;
        }
        // 光源/发光物
        int materialIdx = camRayIsect.faceMaterialIdx;
        MaterialInfo material = getMaterialInfo(materialIdx);
        vec3 emit = material.emitIntensity;
        acc += scale * LeWeight * emit;

        // 计算直接光照
        vec3 lDir = vec3(0.0);
        vec3 P = ray.origin + ray.direct * camRayIsect.nearestTUV.x;
        vec3 wo = -ray.direct;
        vec3 N = camRayIsect.faceNormal;

        vec3 EP = sampleLight(); // 在光源上采样点
        vec3 shadowRayOrigin = P + N * 0.0003;
        Ray shadowRay = Ray(shadowRayOrigin, normalize(EP - shadowRayOrigin));
        Intersection shadowRayIsect = sceneIntersect(shadowRay);

        if (0 <= shadowRayIsect.nearestFaceIdx && shadowRayIsect.hitFront) {
            // 如果直接碰到光源，则计算 brdf
            int maskMaterialIdx = shadowRayIsect.faceMaterialIdx;
            MaterialInfo maskMaterial = getMaterialInfo(maskMaterialIdx);

            vec3 emit = maskMaterial.emitIntensity;

            if (0.0 < emit.r) {
                vec3 ws = shadowRay.direct;
                vec3 Ns = shadowRayIsect.faceNormal;
                float negWsDotNs = dot(-ws, Ns);
                float dSquare = shadowRayIsect.nearestTUV.x * shadowRayIsect.nearestTUV.x;

                float lightPdfArea = 1.0 / u_areaOfLightSum;

                // https://www.bilibili.com/video/BV1X7411F744?p=16
                // L_dir = L_i * f_r * cos_theta * cos_theta_x / |x-p|^2 / pdf_light
                vec3 brdf = eval(ws, wo, N, materialIdx);
                float wsDotN = dot(ws, N);
                lDir = emit * brdf * max(0.0, wsDotN) * max(0.0, negWsDotNs) / dSquare / lightPdfArea;

                #if MIS_ON
                // MIS pdf 度量统一 https://zhuanlan.zhihu.com/p/397068211
                // https://pbr-book.org/3ed-2018/Light_Transport_I_Surface_Reflection/Sampling_Light_Sources#Shape::Pdf
                // https://canvas.dartmouth.edu/courses/35073/files/folder/Slides?preview=5701930 102 页
                float lightPdfDw = lightPdfArea * dSquare / abs(negWsDotNs);
                float scatteringPdf = pdf(ws, wo, N, materialIdx);
                float w1 = powerHeuristic(lightPdfDw, scatteringPdf);

                lDir *= w1;
                #endif
            }
        }

        acc += scale * lDir;

        // 计算间接光照，需要 RR
        float pRR = rand();
        if (P_RR < pRR) {
            break;
        }
        vec3 pwi = sampleHemisphere(wo, N, materialIdx); // p 点输入光线的立体角
//        float scatteringPdf;
//        vec3 pwi = SampleHemisphereCos(scatteringPdf);
        Ray ray2 = Ray(shadowRayOrigin , pwi); // secondary ray
        Intersection ray2Isect = sceneIntersect(ray2);

        if (ray2Isect.nearestFaceIdx == -1 || !ray2Isect.hitFront) {
            break;
        }

        // L_indir = shade(q, wi) * eval(wo, wi, N) * dot(wi, N) / pdf(wo, wi, N) / RussianRoulette
        float scatteringPdf = pdf(pwi, wo, N, materialIdx);

        MaterialInfo ray2IsectMatInfo = getMaterialInfo(ray2Isect.faceMaterialIdx);
        vec3 nextLe = ray2IsectMatInfo.emitIntensity;
        #if MIS_ON
        if (0.0 < nextLe.x) {
            // 碰到发光物体，计算 MIS 权重
            vec3 ws = ray2.direct;
            vec3 Ns = ray2Isect.faceNormal;
            float negWsDotNs = dot(-ws, Ns);
            float dSquare = ray2Isect.nearestTUV.x * ray2Isect.nearestTUV.x;

            float lightPdfArea = 1.0 / u_areaOfLightSum;
            float lightPdfDw = lightPdfArea * dSquare / abs(negWsDotNs);
            LeWeight = powerHeuristic(scatteringPdf, lightPdfDw);
        } else {
            LeWeight = 1.0;
        }
        #endif

        vec3 nextScale = eval(pwi, wo, N, materialIdx) * max(0.0, dot(pwi, N)) / scatteringPdf / P_RR;
        ray = ray2;
        camRayIsect = ray2Isect;
        scale *= nextScale;
    }
    return acc;
}


void main() {
    // 渲染背景色
    glFragColor = vec4(0.0, 0.0, 0.0, 1.0);

    Ray primaryRay = Ray(u_eye_pos, normalize(v_pos_world - u_eye_pos));
    vec3 color = castRay(primaryRay);
    // 色调映射
//    color = vec3(1.0) - exp(-color * u_exposure);
    // Gamma 校正
//    color = pow(color, vec3(1.0/2.2));

    glFragColor.rgb = color;

    // https://zhuanlan.zhihu.com/p/58692781 滤波算法：Sn = Sn-1 * (n-1)/n + Cn / n
    if (u_renderCount != 0) {
        vec4 prevPixelColor = texelFetch(u_prevResult, ivec2(gl_FragCoord.xy), 0);
        glFragColor.rgb = (prevPixelColor.rgb * vec3(u_renderCount - 1) + glFragColor.rgb) / vec3(u_renderCount);
    }
}
