import { mat4, vec3 } from "gl-matrix";
import { Mesh, Scene, DistantLight, PointLight } from "./engine";
import { Camera } from "./webgl-camera";
import Stats from "stats.js";

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("webgl"); // 2d

if (!ctx) {
  throw new Error("Not support webgl");
}

let cubeMesh = new Mesh("Cube");
cubeMesh.vertices.push(
  vec3.fromValues(-0.5, 0.5, 0.5), // 左上后
  vec3.fromValues(0.5, 0.5, 0.5), // 右上后
  vec3.fromValues(-0.5, -0.5, 0.5), // 左下后
  vec3.fromValues(0.5, -0.5, 0.5), // 右下后

  vec3.fromValues(-0.5, 0.5, -0.5), // 左上前
  vec3.fromValues(0.5, 0.5, -0.5), // 右上前
  vec3.fromValues(-0.5, -0.5, -0.5), //左下前
  vec3.fromValues(0.5, -0.5, -0.5) // 右下前
);
cubeMesh.normals.push(
  vec3.fromValues(0, 0, 1), // 后
  vec3.fromValues(0, 0, -1), // 前
  vec3.fromValues(1, 0, 0), // 右
  vec3.fromValues(-1, 0, 1), // 左
  vec3.fromValues(0, 1, 0), // 上
  vec3.fromValues(0, -1, 0) // 下
);
cubeMesh.faces.push(
  { A: 0, B: 2, C: 1, AN: 0, BN: 0, CN: 0 },
  { A: 1, B: 2, C: 3, AN: 0, BN: 0, CN: 0 },
  { A: 4, B: 5, C: 7, AN: 1, BN: 1, CN: 1 },
  { A: 4, B: 7, C: 6, AN: 1, BN: 1, CN: 1 },

  { A: 5, B: 4, C: 0, AN: 4, BN: 4, CN: 4 },
  { A: 5, B: 0, C: 1, AN: 4, BN: 4, CN: 4 },
  { A: 6, B: 7, C: 2, AN: 5, BN: 5, CN: 5 },
  { A: 7, B: 3, C: 2, AN: 5, BN: 5, CN: 5 },

  { A: 0, B: 4, C: 6, AN: 3, BN: 3, CN: 3 },
  { A: 0, B: 6, C: 2, AN: 3, BN: 3, CN: 3 },
  { A: 5, B: 1, C: 3, AN: 2, BN: 2, CN: 2 },
  { A: 5, B: 3, C: 7, AN: 2, BN: 2, CN: 2 }
);
cubeMesh.verticesColor.push(
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 }, // 0 1 0
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },

  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 }
);

let planeMesh = new Mesh("Ground");
planeMesh.vertices.push(
  vec3.fromValues(-5, 0, -5),
  vec3.fromValues(5, 0, -5),
  vec3.fromValues(-5, 0, 5),
  vec3.fromValues(5, 0, 5)
);
planeMesh.position = vec3.fromValues(0, -2, 0);
planeMesh.normals.push(vec3.fromValues(0, 1, 0));
planeMesh.faces.push(
  { A: 0, B: 2, C: 1, AN: 0, BN: 0, CN: 0 },
  { A: 1, B: 2, C: 3, AN: 0, BN: 0, CN: 0 }
);
planeMesh.verticesColor.push(
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 }
);

let distantLight = new DistantLight(
  mat4.fromXRotation(mat4.create(), (-90 * Math.PI) / 180),
  { r: 1, g: 1, b: 1 },
  15
);
let pointLight1 = new PointLight(
  mat4.fromTranslation(mat4.create(), [-2, 2, 0]),
  { r: 0.6, g: 0.6, b: 1 },
  1000
);
let pointLight2 = new PointLight(
  mat4.fromTranslation(mat4.create(), [2, 2, 0]),
  { r: 1, g: 0.6, b: 0.6 },
  1000
);
let scene = new Scene([planeMesh, cubeMesh], [distantLight]);

let camera = new Camera(canvas.width, canvas.height);
camera.position = vec3.fromValues(0, 2, 3);
camera.target = vec3.fromValues(0, -1, 0);

function drawingLoop() {
  stats.begin();
  camera.render(scene, ctx);
  cubeMesh.rotation[0] += 0.01;
  cubeMesh.rotation[1] += 0.01;
  stats.end();
  requestAnimationFrame(drawingLoop);
}

requestAnimationFrame(drawingLoop);
// setInterval(drawingLoop, 5000);
