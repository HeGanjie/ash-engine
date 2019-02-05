import { Mesh, Scene } from "./engine";
import { Camera } from "./ray-tracking-camera";
//import { Camera } from "./rasterization-camera";
import { Vector3 } from "./math";

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let mesh = new Mesh("Cube");
mesh.vertices.push(
  new Vector3(-0.5, 0.5, 0.5), // 左上后
  new Vector3(0.5, 0.5, 0.5), // 右上后
  new Vector3(-0.5, -0.5, 0.5), // 左下后
  new Vector3(-0.5, -0.5, -0.5), //左下前
  new Vector3(-0.5, 0.5, -0.5),
  new Vector3(0.5, 0.5, -0.5),
  new Vector3(0.5, -0.5, 0.5),
  new Vector3(0.5, -0.5, -0.5)
);

mesh.verticesColor.push(
  { r: 1, g: 0, b: 0 },
  { r: 0, g: 1, b: 0 },
  { r: 0, g: 0, b: 1 },
  { r: 1, g: 1, b: 1 },

  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 }
);

mesh.faces.push({ A: 0, B: 2, C: 1 }, { A: 5, B: 7, C: 6 });

let scene = new Scene([mesh]);

let camera = new Camera(200, 150);
camera.position = new Vector3(0, 0, 2.5);
camera.target = new Vector3(0, 0, 0);

// https://stackoverflow.com/a/5111475/1745885
let filterStrength = 2;
let frameTime = 0,
  lastLoop = Date.now(),
  thisLoop;

function drawingLoop() {
  camera.render(scene, ctx);
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;
  requestAnimationFrame(drawingLoop);

  let thisFrameTime = (thisLoop = Date.now()) - lastLoop;
  frameTime += (thisFrameTime - frameTime) / filterStrength;
  lastLoop = thisLoop;
}

requestAnimationFrame(drawingLoop);
// setInterval(drawingLoop, 5000);

let fpsOut = document.getElementById("fps");
setInterval(function() {
  fpsOut.innerText = (1000 / frameTime).toFixed(1) + " fps";
}, 1000);
