import { mat4, vec3 } from "gl-matrix";
import { Mesh, Scene } from "./engine";
import { Camera } from "./webgl-camera";
import Stats from "stats.js";
import {DistantLight} from "./distant-light";
import {PointLight} from "./point-light";

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
  vec3.fromValues(-1, 0, 0), // 左
  vec3.fromValues(0, 1, 0), // 上
  vec3.fromValues(0, -1, 0) // 下
);
cubeMesh.faces.push(
  { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
  { data:  [{V: 4, N: 1}, {V: 5, N: 1}, {V: 7, N: 1}, {V: 6, N: 1}] },
  { data:  [{V: 1, N: 2}, {V: 3, N: 2}, {V: 7, N: 2}, {V: 5, N: 2}] },
  { data:  [{V: 0, N: 3}, {V: 4, N: 3}, {V: 6, N: 3}, {V: 2, N: 3}] },
  { data:  [{V: 0, N: 4}, {V: 1, N: 4}, {V: 5, N: 4}, {V: 4, N: 4}] },
  { data:  [{V: 2, N: 5}, {V: 6, N: 5}, {V: 7, N: 5}, {V: 3, N: 5}] },
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
  { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
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
