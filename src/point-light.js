import {vec3} from "gl-matrix";
import {mat4MultVec3} from "./math";
import {Light} from "./engine";

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