import { vec3 } from "gl-matrix";
import { mat4MultVec3 } from "./math";

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
  position = null;
  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.position = vec3.fromValues(0, 0, 0);
    mat4MultVec3(this.position, l2w, this.position);
  }
  getShadowLightDirection(out, pHit) {
    vec3.subtract(out, this.position, pHit);
    vec3.normalize(out, out);
  }
}

export class DistantLight extends Light {
  direction = null;
  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.direction = vec3.fromValues(0, 0, -1);
    mat4MultVec3(this.direction, l2w, this.direction);
  }
  getShadowLightDirection(out, pHit) {
    vec3.scale(out, this.direction, -1);
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

  constructor(orig = vec3.create(), dir = vec3.fromValues(0, 0, -1)) {
    this.origin = orig;
    this.direction = dir;
  }
}
