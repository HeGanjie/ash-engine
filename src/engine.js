import { Vector3, Vector2, Matrix, edgeFunction } from "./math";
import { zip, flatMap, isEmpty } from "lodash";
let { PI, tan, floor, ceil, min, max } = Math;

export const defaultColor = { r: 1, g: 1, b: 1 };

export class Mesh {
  position = Vector3.zero();
  rotation = Vector3.zero();
  vertices = [];
  verticesColor = [];
  faces = [];
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
  constructor(meshes) {
    this.meshes = meshes;
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
