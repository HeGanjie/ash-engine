import {vec3} from "gl-matrix";
import {Light} from "./engine";

export class PointLight extends Light {
  position = null;

  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.position = vec3.fromValues(0, 0, 0);
    vec3.transformMat4(this.position, this.position, l2w)
  }

  getShadowLightDirection(out, pHit) {
    vec3.subtract(out, this.position, pHit);
    vec3.normalize(out, out);
  }
}