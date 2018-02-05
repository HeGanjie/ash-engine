import {Vector3} from './math'

export class Camera {
  position = Vector3.zero()
  target = Vector3.zero()

  render(scene, ctx) {

  }
}

export class Mesh {
  position = Vector3.zero()
  rotation = Vector3.zero()
  vertices = null
  name = null

  constructor(name, verticesCount) {
    this.name = name
    this.vertices = new Array(verticesCount)
  }
}

export class Scene {
  meshes = null
  constructor(meshes) {
    this.meshes = meshes
  }
}
