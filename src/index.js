import {Camera, Mesh, Scene} from './engine'
import {Vector3} from './math'


let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d');

let mesh = new Mesh("Cube");
mesh.vertices.push(
  new Vector3(-1, 1, 1), // 左上后
  new Vector3(1, 1, 1), // 右上后
  new Vector3(-1, -1, 1), // 左下后
  new Vector3(-1, -1, -1), //左下前
  new Vector3(-1, 1, -1),
  new Vector3(1, 1, -1),
  new Vector3(1, -1, 1),
  new Vector3(1, -1, -1)
)

mesh.faces.push(
    { A: 0, B: 1, C: 2 }
)

let scene = new Scene([mesh])

let camera = new Camera(400, 300);
camera.position = new Vector3(0, 0, 5);
camera.target = new Vector3(0, 0, 0);

// https://stackoverflow.com/a/5111475/1745885
let filterStrength = 2;
let frameTime = 0, lastLoop = Date.now(), thisLoop;

function drawingLoop() {
  camera.render(scene, ctx)
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;
  requestAnimationFrame(drawingLoop);

  let thisFrameTime = (thisLoop = Date.now()) - lastLoop;
  frameTime += (thisFrameTime - frameTime) / filterStrength;
  lastLoop = thisLoop;
}


requestAnimationFrame(drawingLoop)

let fpsOut = document.getElementById('fps');
setInterval(function() {
  fpsOut.innerText = (1000/frameTime).toFixed(1) + " fps";
},1000);
