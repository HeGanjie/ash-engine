import {vec3} from "gl-matrix";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  fov = Math.PI / 2;

  constructor() {
  }

  render(scene, gl) {

  }
}
