import { Mesh, Scene, DistantLight, PointLight } from "./engine";
// import { Camera } from "./ray-tracking-camera";
//import { Camera } from "./rasterization-camera";
import { Camera } from "./webgl-camera";
import { Vector3, Matrix } from "./math";

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("webgl"); // 2d

if (!ctx) {
  throw new Error("Not support webgl");
}

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
cubeMesh.normals.push(
  new Vector3(0, 0, 1), // 后
  new Vector3(0, 0, -1), // 前
  new Vector3(1, 0, 0), // 右
  new Vector3(-1, 0, 1), // 左
  new Vector3(0, 1, 0), // 上
  new Vector3(0, -1, 0) // 下
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
  new Vector3(-5, -2, -5),
  new Vector3(5, -2, -5),
  new Vector3(-5, -2, 5),
  new Vector3(5, -2, 5)
);
planeMesh.normals.push(new Vector3(0, 1, 0));
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
  Matrix.rotateX(-Math.PI / 2),
  { r: 1, g: 1, b: 1 },
  15
);
let pointLight1 = new PointLight(
  Matrix.transformXYZ(-2, 2, 0),
  { r: 0.6, g: 0.6, b: 1 },
  1000
);
let pointLight2 = new PointLight(
  Matrix.transformXYZ(2, 2, 0),
  { r: 1, g: 0.6, b: 0.6 },
  1000
);
let scene = new Scene([planeMesh, cubeMesh], [distantLight]);

let camera = new Camera(canvas.width, canvas.height);
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
