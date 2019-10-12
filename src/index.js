import { mat4, vec3 } from "gl-matrix";
import {Geometry, Material, Mesh, Scene} from './engine'
import { Camera } from "./webgl-camera";
import Stats from "stats.js";
import {DistantLight} from "./distant-light";
import {PointLight} from "./point-light";

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("webgl2"); // 2d

if (!ctx) {
  throw new Error("Not support webgl2");
}

let cubeMaterial = new Material({
  color: { r: 1, g: 1, b: 1 },
  kS: 0.15,
  kD: 1 - 0.15,
  specularExp: 250
})
let cubeMesh = new Mesh("Cube", Geometry.BoxGeometry, cubeMaterial);

let planeMaterial = new Material({
  color: { r: 0.5, g: 0.5, b: 0.5 },
  kS: 0.04,
  kD: 1 - 0.04,
  specularExp: 2
})
let planeMesh = new Mesh("Ground", Geometry.PlaneGeometry, planeMaterial);
planeMesh.position = vec3.fromValues(0, -2, 0);
planeMesh.scale = vec3.fromValues(10, 1, 10);

let distantLight = new DistantLight(
  mat4.fromXRotation(mat4.create(), (-90* Math.PI) / 180),
  { r: 1, g: 1, b: 1 },
  10
);

let distantLight2 = new DistantLight(
  mat4.fromXRotation(mat4.create(), (-135 * Math.PI) / 180),
  { r: 1, g: 1, b: 1 },
  20
);
let pointLight1 = new PointLight(
  mat4.fromTranslation(mat4.create(), [-2, 2, 0]),
  { r: 0.6, g: 0.6, b: 1 },
  500
);
let pointLight2 = new PointLight(
  mat4.fromTranslation(mat4.create(), [2, 2, 0]),
  { r: 1, g: 0.6, b: 0.6 },
  500
);
let scene = new Scene([planeMesh, cubeMesh], [distantLight, pointLight1, pointLight2]);

let camera = new Camera(canvas.width, canvas.height);
camera.position = vec3.fromValues(0, 2, 3);
camera.target = vec3.fromValues(0, -1, 0);

const radToAngle = 180 / Math.PI;
// const rotDistanceLight = mat4.fromXRotation(mat4.create(), -0.05 * Math.PI / 180);

function drawingLoop() {
  stats.begin();
  camera.render(scene, ctx);
  cubeMesh.rotation[0] += 0.01 * radToAngle;
  cubeMesh.rotation[1] += 0.01 * radToAngle;

  // vec3.transformMat4(distantLight.direction, distantLight.direction, rotDistanceLight);
  // vec3.normalize(distantLight.direction, distantLight.direction)
  stats.end();
  requestAnimationFrame(drawingLoop);
}

requestAnimationFrame(drawingLoop);
// setInterval(drawingLoop, 5000);
