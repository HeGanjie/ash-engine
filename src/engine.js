import { Vector3, Vector2, Matrix, edgeFunction, mat4MultVec3 } from "./math";
import { zip, flatMap, isEmpty } from "lodash";
let { PI, tan, floor, ceil, min, max } = Math;

export const defaultColor = { r: 1, g: 1, b: 1 };

class Light {
  lightToWorld = null;
  color = null;
  intensity = 1;

  constructor(l2w, color, intensity) {
    this.lightToWorld = l2w;
    this.color = color;
    this.intensity = intensity;
  }
}

export class PointLight extends Light {
  position = Vector3.zero();
  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.position = mat4MultVec3(l2w, Vector3.zero());
  }
  getShadowLightDirection(pHit) {
    let d0 = this.position.subtract(pHit);
    d0.normalize();
    return d0;
  }
}

export class DistantLight extends Light {
  direction = null;
  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.direction = mat4MultVec3(l2w, new Vector3(0, 0, -1));
  }
  getShadowLightDirection(pHit) {
    return this.direction.scale(-1);
  }
}

export class Mesh {
  position = Vector3.zero();
  rotation = Vector3.zero();
  vertices = [];
  verticesColor = [];
  faces = [];
  albedo = 0.18;
  name = null;

  constructor(name) {
    this.name = name;
  }

  toMatrix() {
    let verts = this.vertices || [];
    let dat = zip(...verts.map(v => [v.x, v.y, v.z, 1]));
    return new Matrix(dat, 4, verts.length);
  }

  toWorldCordMatrix() {
    let mRo = Matrix.rotateXYZ(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z
    );
    let mTr = Matrix.transformXYZ(
      this.position.x,
      this.position.y,
      this.position.z
    );
    return mRo.mul(mTr).mul(this.toMatrix());
  }
}

export class Scene {
  meshes = null;
  lights = null;
  constructor(meshes, lights) {
    this.meshes = meshes;
    this.lights = lights;
  }
}

export class Ray {
  origin = null;
  direction = null; // normalized

  constructor(orig = Vector3.zero(), dir = new Vector3(0, 0, -1)) {
    this.origin = orig;
    this.direction = dir;
  }
}
