import { mat4, vec3 } from "gl-matrix";

// import weblas from "weblas";
// let weblas = require("weblas");
let { sin, cos, tan, PI } = Math;

export function mat4MultVec3(outVec3, mat4, vec3, w = 1) {
  let [x, y, z] = vec3;
  let nextW = mat4[3] * x + mat4[7] * y + mat4[11] * z + mat4[15] * w;
  outVec3[0] = (mat4[0] * x + mat4[4] * y + mat4[8] * z + mat4[12] * w) / nextW;
  outVec3[1] = (mat4[1] * x + mat4[5] * y + mat4[9] * z + mat4[13] * w) / nextW;
  outVec3[2] =
    (mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14] * w) / nextW;
  return outVec3
}

export function camera2World(out, cameraPos, lookAt, up0 = vec3.fromValues(0, 1, 0)) {
  let forward = vec3.subtract(vec3.create(), cameraPos, lookAt);
  vec3.normalize(forward, forward);
  let right = vec3.cross(vec3.create(), up0, forward);
  vec3.normalize(right, right);
  let up = vec3.cross(vec3.create(), forward, right);
  vec3.normalize(up, up);
  return mat4.set(out, ...right, 0, ...up, 0, ...forward, 0, ...cameraPos, 1);
  /*return new Matrix(
    [
      right.x,      up.x,      forward.x,      cameraPos.x,
      right.y,      up.y,      forward.y,      cameraPos.y,
      right.z,      up.z,      forward.z,      cameraPos.z,
      0,      0,      0,      1
    ],
    4,
    4
  );*/
}

export function mat4RotateXYZ(out, src, x, y, z) {
  mat4.rotateX(out, src, x);
  mat4.rotateY(out, out, y);
  mat4.rotateZ(out, out, z);
  return out;
}

export function webglPerspectiveProjectionMatrix(fovY, aspectRatio, near, far) {
  let top = tan(fovY / 2) * near,
    bottom = -top,
    right = top * aspectRatio,
    left = -right;
  let r_l = right - left,
    t_b = top - bottom,
    f_n = far - near;

  return mat4.fromValues(
    (2 * near) / r_l, 0, 0, 0,
    0, (2 * near) / t_b, 0, 0,
    (right + left) / r_l, (top + bottom) / t_b, -(far + near) / f_n, -1,
    0, 0, (-2 * far * near) / f_n, 0
  );
  /*return new Matrix(
    [
      (2 * near) / r_l,        0,        (right + left) / r_l,        0,
      0,        (2 * near) / t_b,        (top + bottom) / t_b,        0,
      0,        0,        -(far + near) / f_n,        (-2 * far * near) / f_n,
      0,        0,        -1,        0
    ],
    4,
    4
  );*/
}

export function webglOrthographicProjectionMatrix(t, b, l, r, n, f) {
  let r_l = r - l,
    t_b = t - b,
    f_n = f - n;
  return mat4.fromValues(
    2 / r_l, 0, 0, 0,
    0, 2 / t_b, 0, 0,
    0, 0, -2 / f_n, 0,
    -(r + l) / r_l, -(t + b) / t_b, -(f + n) / f_n, 1
  );
  /*return new Matrix(
    [
      2 / r_l, 0,        0,        -(r + l) / r_l,
      0,        2 / t_b,        0,        -(t + b) / t_b,
      0,        0,        -2 / f_n,        -(f + n) / f_n,
      0,        0,        0,        1
    ],
    4,
    4
  );*/
}
