import { vec3, mat4 } from "gl-matrix";
import { mat4MultVec3 } from "./math";
import {flatMap, isEmpty} from 'lodash'
import earcut from 'earcut'

window.earcut = earcut

export const defaultColor = { r: 1, g: 1, b: 1 };

export class Light {
  lightToWorld = null;
  color = null;
  intensity = 1;

  constructor(l2w, color, intensity) {
    this.lightToWorld = l2w;
    this.color = color;
    this.intensity = intensity;
  }
}

export class Mesh {
  position = vec3.create();
  rotation = vec3.create();
  vertices = [];
  normals = [];
  verticesColor = [];
  faces = [];
  albedo = 0.18;
  name = null;

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
        vPos = flatMap(f.data, ({V}) => [...mat4MultVec3(vec3.create(), w2c, vertices[V])]);
      } else {
        vPos = flatMap(f.data, ({V}) => [...vertices[V]]);
      }
      f.triangleIndices = earcut(vPos, null, 3);
      if (isEmpty(f.triangleIndices)) {
        throw new Error('triangulation error: ' + f)
      }
    })
  }
}

export class Scene {
  meshes = null;
  lights = null;
  constructor(meshes, lights) {
    this.meshes = meshes;
    this.lights = lights;
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
