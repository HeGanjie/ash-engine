#version 300 es
precision mediump float;
precision mediump int;

in vec3 v_pos_world;

uniform vec2 u_resolution;
uniform vec3 u_eye_pos;
// 模型信息
uniform vec3 u_vertices[NUM_VERTICES_COUNT];
uniform ivec3 u_indices[NUM_FACES_COUNT];
uniform int u_face_material_ids[NUM_FACES_COUNT];
uniform mat4 u_local_to_world_matrixs[NUM_MESHES_COUNT];

out vec4 glFragColor;

struct Ray {
    vec3 origin;
    vec3 direct;
    float t;
};

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

void main() {
    Ray ray = Ray(u_eye_pos, normalize(v_pos_world - u_eye_pos), -1.0);
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
    // TODO 计算直接光照（直接采样光源）
    if (0 <= nearestFaceIdx) {
        float depth = nearestTUV.x / 1500.0;
        glFragColor = vec4(depth, depth, depth, 1.0);
    } else {
        // 渲染背景色
        glFragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
