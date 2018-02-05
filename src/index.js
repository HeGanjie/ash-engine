import {Camera, Mesh, Scene} from './engine'
import {Vector3} from './math'

let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d');

let mesh = new Mesh("Cube", 8);
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
camera.Position = new Vector3(0, 0, 10);
camera.Target = new Vector3(0, 0, 0);
camera.render(scene, ctx)

