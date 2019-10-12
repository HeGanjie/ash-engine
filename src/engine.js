import { vec3, mat4 } from "gl-matrix";
import {flatMap, isEmpty, orderBy} from 'lodash'
import earcut from 'earcut'
import {DistantLight} from "./distant-light";

window.earcut = earcut

export const defaultColor = { r: 1, g: 1, b: 1 };

export class Geometry {
  vertices = null
  normals = null
  faces = null

  constructor(opts) {
    Object.assign(this, opts)
  }

  static PlaneGeometry = new Geometry({
    vertices: [
      vec3.fromValues(-0.5, 0, -0.5),
      vec3.fromValues(0.5, 0, -0.5),
      vec3.fromValues(-0.5, 0, 0.5),
      vec3.fromValues(0.5, 0, 0.5)
    ],
    normals: [
      vec3.fromValues(0, 1, 0)
    ],
    faces: [
      { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
    ]
  })

  static BoxGeometry = new Geometry({
    vertices: [
      vec3.fromValues(-0.5, 0.5, 0.5), // 左上后
      vec3.fromValues(0.5, 0.5, 0.5), // 右上后
      vec3.fromValues(-0.5, -0.5, 0.5), // 左下后
      vec3.fromValues(0.5, -0.5, 0.5), // 右下后

      vec3.fromValues(-0.5, 0.5, -0.5), // 左上前
      vec3.fromValues(0.5, 0.5, -0.5), // 右上前
      vec3.fromValues(-0.5, -0.5, -0.5), //左下前
      vec3.fromValues(0.5, -0.5, -0.5) // 右下前
    ],
    normals: [
      vec3.fromValues(0, 0, 1), // 后
      vec3.fromValues(0, 0, -1), // 前
      vec3.fromValues(1, 0, 0), // 右
      vec3.fromValues(-1, 0, 0), // 左
      vec3.fromValues(0, 1, 0), // 上
      vec3.fromValues(0, -1, 0) // 下
    ],
    faces: [
      { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
      { data:  [{V: 4, N: 1}, {V: 5, N: 1}, {V: 7, N: 1}, {V: 6, N: 1}] },
      { data:  [{V: 1, N: 2}, {V: 3, N: 2}, {V: 7, N: 2}, {V: 5, N: 2}] },
      { data:  [{V: 0, N: 3}, {V: 4, N: 3}, {V: 6, N: 3}, {V: 2, N: 3}] },
      { data:  [{V: 0, N: 4}, {V: 1, N: 4}, {V: 5, N: 4}, {V: 4, N: 4}] },
      { data:  [{V: 2, N: 5}, {V: 6, N: 5}, {V: 7, N: 5}, {V: 3, N: 5}] }
    ]
  })
}

export class Material {
  color = null
  diffuseMap = null
  specularMap = null
  normalMap = null // null then always face normal
  albedo = 0.18;
  kD = 0.98; // phong model diffuse weight
  kS = 0.02; // phong model specular weight
  specularExp = 1;   // phong specular exponent

  constructor(opts) {
    Object.assign(this, opts)
  }
}

export class Mesh {
  position = vec3.create();
  rotation = vec3.create();
  scale = vec3.fromValues(1, 1, 1);
  geometry = null;
  material = null;
  name = null;

  constructor(name, geometry, material) {
    this.name = name;
    this.geometry = geometry;
    this.material = material;
  }

  triangulation() {
    let {faces, vertices, normals} = this.geometry;
    let xyPanelNormal = vec3.fromValues(0, 0, 1);
    let xzPanelNormal = vec3.fromValues(0, 1, 0);
    let vec3Zero = vec3.fromValues(0, 0, 0);
    faces.forEach(f => {
      let faceNormal = normals[f.data[0].N];
      let needRotate = vec3.dot(faceNormal, xyPanelNormal) < 0.9;
      let vPos;
      if (needRotate) {
        // do triangulation after rotate face to x-y plane
        let needRotateUpVec = 0.95 < Math.abs(vec3.dot(faceNormal, xzPanelNormal));
        let up = needRotateUpVec ? vec3.fromValues(0, 0, -1) : vec3.fromValues(0, 1, 0);
        let w2c = mat4.lookAt(mat4.create(), faceNormal, vec3Zero, up)
        vPos = flatMap(f.data, ({V}) => [...vec3.transformMat4(vec3.create(), vertices[V], w2c)]);
      } else {
        vPos = flatMap(f.data, ({V}) => [...vertices[V]]);
      }
      // [2, 3, 0, 0, 1, 2]
      f.triangleIndices = earcut(vPos, null, 3);
      if (isEmpty(f.triangleIndices)) {
        throw new Error('triangulation error: ' + f)
      }
      f.triangleIndicesForVertexes = f.triangleIndices.map(ti => f.data[ti].V)
    })
  }

  getVerticesColorByIndex(pointIndex) {
    return this.material.color;
  }
}

export class Scene {
  meshes = null;
  lights = null;
  constructor(meshes, lights) {
    this.meshes = meshes;
    this.lights = orderBy(lights, l => l instanceof DistantLight ? 0 : 1);
    meshes.forEach(m => m.triangulation())
  }
}

export class Ray {
  origin = null;
  direction = null; // normalized

  constructor(orig = vec3.create(), dir = vec3.fromValues(0, 0, -1)) {
    this.origin = orig;
    this.direction = dir;
  }
}
