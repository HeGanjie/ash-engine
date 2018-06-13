import {Vector3, Vector2, Matrix} from './math'
let {zip} = window._
let {PI, tan} = Math

export class Camera {
  width = 400
  height = 300
  position = Vector3.zero()
  target = Vector3.zero()

  constructor(width, height) {
    this.width = width
    this.height = height
  }

  drawPoint(backbuffer, p, r, g, b, a) {
    if (p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height) {
      let backbufferdata = backbuffer.data;
      let index = (p.x + p.y * this.width) * 4;
      backbufferdata[index] = r * 255;
      backbufferdata[index + 1] = g * 255;
      backbufferdata[index + 2] = b * 255;
      backbufferdata[index + 3] = a * 255;
    }
  }

  render(scene, ctx, fov = PI/2) {
    let c2w = Matrix.camera2World(this.position, this.target) // 4 * 4
    let w2c = c2w.inv()
    let worldMs = scene.meshes.map(m => m.toWorldCordMatrix()) // 4 * Vcount
    let cameraMs = worldMs.map(m => w2c.mul(m)) // 4 * Vcount
    // let pp = Matrix.perspectiveProjection(fov) // 4 * 4
    // let screen3Ds = cameraMs.map(m => pp.mul(m)) // 4 * Vcount

    let screen2Ds = cameraMs.map(m => {
      let arr = []
      let mArr = m.data
      for (let j = 0, jy = m.colCount, jz = m.colCount * 2; j < m.colCount; j++, jy++, jz++) {
        let mz = -mArr[jz]
        arr.push(new Vector2(mArr[j] / mz, mArr[jy] / mz))
      }
      return arr
    })

    let imageWidth = tan(fov/2) * 2, imageHeight = this.height * imageWidth / this.width,
        imageWidthDiv2 = imageWidth / 2, imageHeightDiv2 = imageHeight / 2
    let ndc2Ds = screen2Ds.map(meshScreenPointArr => {
      return meshScreenPointArr.map(v2 => {
        return new Vector2((v2.x + imageWidthDiv2) / imageWidth, (v2.y + imageHeightDiv2) / imageHeight)
      })
    })

    let raster2Ds = ndc2Ds.map(meshNDCPointArr => {
      return meshNDCPointArr.map(v2 => {
        return new Vector2(Math.floor(v2.x * this.width), Math.floor((1 - v2.y) * this.height))
      })
    })

    ctx.clearRect(0, 0, this.width, this.height);
    let backbuffer = ctx.getImageData(0, 0, this.width, this.height)
    raster2Ds.forEach(points => {
      points.forEach(p => this.drawPoint(backbuffer, p, 1, 1, 1, 1))
    })
    ctx.putImageData(backbuffer, 0, 0)
  }
}

export class Mesh {
  position = Vector3.zero()
  rotation = Vector3.zero()
  vertices = []
  faces = []
  name = null

  constructor(name) {
    this.name = name
  }

  toMatrix() {
    let verts = this.vertices || []
    let dat = zip(...verts.map(v => [v.x, v.y, v.z, 1]))
    return new Matrix(dat, 4, verts.length)
  }

  toWorldCordMatrix() {
    let mRo = Matrix.rotateXYZ(this.rotation.x, this.rotation.y, this.rotation.z)
    let mTr = Matrix.transformXYZ(this.position.x, this.position.y, this.position.z)
    return mRo.mul(mTr).mul(this.toMatrix())
  }
}

export class Scene {
  meshes = null
  constructor(meshes) {
    this.meshes = meshes
  }
}
