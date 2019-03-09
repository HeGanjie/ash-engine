import _, { chunk } from "lodash";
//import { mat4 } from "gl-matrix";

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
}
