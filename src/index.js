import { Mesh, Scene, DistantLight, PointLight } from "./engine";
import { Camera } from "./ray-tracking-camera";
//import { Camera } from "./rasterization-camera";
import { Vector3, Matrix } from "./math";

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let cubeMesh = new Mesh("Cube");
cubeMesh.vertices.push(
  new Vector3(-0.5, 0.5, 0.5), // 左上后
  new Vector3(0.5, 0.5, 0.5), // 右上后
  new Vector3(-0.5, -0.5, 0.5), // 左下后
  new Vector3(0.5, -0.5, 0.5), // 右下后

  new Vector3(-0.5, 0.5, -0.5), // 左上前
  new Vector3(0.5, 0.5, -0.5), // 右上前
  new Vector3(-0.5, -0.5, -0.5), //左下前
  new Vector3(0.5, -0.5, -0.5) // 右下前
);
cubeMesh.faces.push(
  { A: 0, B: 2, C: 1 },
  { A: 1, B: 2, C: 3 },
  { A: 4, B: 5, C: 7 },
  { A: 4, B: 7, C: 6 },

  { A: 5, B: 4, C: 0 },
  { A: 5, B: 0, C: 1 },
  { A: 6, B: 7, C: 2 },
  { A: 7, B: 3, C: 2 },

  { A: 0, B: 4, C: 6 },
  { A: 0, B: 6, C: 2 },
  { A: 5, B: 1, C: 3 },
  { A: 5, B: 3, C: 7 }
);
cubeMesh.verticesColor.push(
  { r: 1, g: 1, b: 1 },
  { r: 0, g: 1, b: 0 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },

  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 },
  { r: 1, g: 1, b: 1 }
);

let planeMesh = new Mesh("Ground");
planeMesh.vertices.push(
  new Vector3(-5, -3, -5),
  new Vector3(5, -3, -5),
  new Vector3(-5, -3, 5),
  new Vector3(5, -3, 5)
);
planeMesh.faces.push({ A: 0, B: 2, C: 1 }, { A: 1, B: 2, C: 3 });
planeMesh.verticesColor.push(
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 },
  { r: 0.5, g: 0.5, b: 0.5 }
);

let distantLight = new DistantLight(
  Matrix.rotateX(-Math.PI / 2),
  { r: 1, g: 1, b: 1 },
  15
);

let scene = new Scene([planeMesh, cubeMesh], [distantLight]);

let camera = new Camera(200, 150);
camera.position = new Vector3(0, 2, 3);
camera.target = new Vector3(0, -1, 0);

// https://stackoverflow.com/a/5111475/1745885
let filterStrength = 2;
let frameTime = 0,
  lastLoop = Date.now(),
  thisLoop;

function drawingLoop() {
  camera.render(scene, ctx);
  cubeMesh.rotation.x += 0.01;
  cubeMesh.rotation.y += 0.01;
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
