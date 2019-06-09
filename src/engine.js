import { vec3, mat4 } from "gl-matrix";
import {flatMap, isEmpty, orderBy} from 'lodash'
import earcut from 'earcut'
import {DistantLight} from "./distant-light";

window.earcut = earcut

export const defaultColor = { r: 1, g: 1, b: 1 };

export class Mesh {
  position = vec3.create();
  rotation = vec3.create();
  vertices = [];
  normals = [];
  verticesColor = [];
  faces = [];
  albedo = 0.18;
  kD = 0.98; // phong model diffuse weight
  kS = 0.02; // phong model specular weight
  specularExp = 1;   // phong specular exponent
  name = null;
  // Material

  constructor(name) {
    this.name = name;
  }

  triangulation() {
    let {faces, vertices, normals} = this;
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
