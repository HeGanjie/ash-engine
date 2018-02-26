import {Camera, Mesh, Scene} from './engine'
import {Vector3} from './math'


let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d');

let mesh = new Mesh("Cube");
mesh.vertices.push(
  new Vector3(-1, 1, 1),
  new Vector3(1, 1, 1),
  new Vector3(-1, -1, 1),
  new Vector3(-1, -1, -1),
  new Vector3(-1, 1, -1),
  new Vector3(1, 1, -1),
  new Vector3(1, -1, 1),
  new Vector3(1, -1, -1)
)

let scene = new Scene([mesh])

let camera = new Camera(400, 300);
camera.position = new Vector3(0, 0, 10);
camera.target = new Vector3(0, 0, 0);

function drawingLoop() {
  camera.render(scene, ctx)
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;
  requestAnimationFrame(drawingLoop);
}


requestAnimationFrame(drawingLoop)
