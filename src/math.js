let {sin, cos, tan, PI} = Math
let weblas = window.weblas
let {inv} = window.math
let {chunk} = window._

export class Matrix {
  data = null
  rowCount = 0
  colCount = 0

  constructor(arr, i, j) {
    if (arr.constructor.name === 'Float32Array') {
      this.data = arr
    } else if (arr[0].constructor.name === 'Array') {
      this.data = weblas.util.fromArray(arr)
    } else {
      this.data = new Float32Array(i * j)
      for (let k = 0; k < arr.length; k++) {
        this.data[k] = arr[k]
      }
    }
    this.rowCount = i
    this.colCount = j
  }

  mul(m2) {
    let v = weblas.sgemm(this.rowCount, m2.colCount, this.colCount, 1.0, this.data, m2.data, 0.0, null)
    return new Matrix(v, this.rowCount, m2.colCount)
  }

  scale(s) {
    let v = weblas.sscal(this.rowCount, this.colCount, s, 0.0, this.data)
    return new Matrix(v, this.rowCount, this.colCount)
  }

  add(a) {
    let v = weblas.sscal(this.rowCount, this.colCount, 1.0, a, this.data)
    return new Matrix(v, this.rowCount, this.colCount)
  }

  static eye(n) {
    let arr = new Float32Array(n * n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        arr[i*n + j] = i === j ? 1 : 0
      }
    }
    return new Matrix(arr, n, n)
  }

  addMatrix(m2) {
    let v = weblas.saxpy(this.rowCount * this.colCount, 1, this.data, m2.data)
    return new Matrix(v, this.rowCount, this.colCount)
  }

  static rotateX(theta) {
    return new Matrix([1, 0, 0, 0,  0, cos(theta), -sin(theta), 0,  0, sin(theta), cos(theta), 0,  0, 0, 0, 1], 4, 4)
  }

  static rotateY(theta) {
    return new Matrix([cos(theta), 0, sin(theta), 0,  0, 1, 0, 0,  -sin(theta), 0, cos(theta), 0,  0, 0, 0, 1], 4, 4)
  }

  static rotateZ(theta) {
    return new Matrix([cos(theta), -sin(theta), 0, 0,  sin(theta), cos(theta), 0, 0,  0, 0, 1, 0,  0, 0, 0, 1], 4, 4)
  }

  static scaleXYZ(sx, sy, sz) {
    return new Matrix([sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, sz, 0,  0, 0, 0, 1], 4, 4)
  }

  static transformXYZ(x, y, z) {
    return new Matrix([1, 0, 0, x,  0, 1, 0, y,  0, 0, 1, z,  0, 0, 0, 1], 4, 4)
  }

  static rotateXYZ(tx, ty, tz) {
    return Matrix.rotateZ(tz).mul(Matrix.rotateY(ty).mul(Matrix.rotateX(tx)))
  }

  static camera2World(cameraPos, lookAt, up0 = Vector3.up()) {
    let forward = cameraPos.subtract(lookAt)
    forward.normalize()
    let right = up0.cross(forward)
    right.normalize()
    let up = forward.cross(right)
    up.normalize()
    return new Matrix([
      right.x, up.x, forward.x, cameraPos.x,
      right.y, up.y, forward.y, cameraPos.y,
      right.z, up.z, forward.z, cameraPos.z,
      0, 0, 0, 1
    ], 4, 4)
  }

  // https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/building-basic-perspective-projection-matrix
  static perspectiveProjection = _.memoize((fov) => {
    let S = 1 / tan(fov / 2)
    return new Matrix([
      S, 0, 0, 0,
      0, S, 0, 0,
      0, 0,-1,-1,
      0, 0, 0, 0
    ], 4, 4)
  })

  inv() {
    if (this.rowCount !== this.colCount) {
      throw new Error('inverse: this must be a square matrix')
    }
    let m = chunk(this.data, this.rowCount)
    let res = inv(m)
    return new Matrix(res, this.rowCount, this.colCount)
  }
}

export class Vector3 {
  x = 0
  y = 0
  z = 0

  static zero() {
    return new Vector3(0, 0, 0)
  }

  static up() {
    return new Vector3(0, 1, 0)
  }

  constructor(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  subtract(otherVector) {
    return new Vector3(this.x - otherVector.x, this.y - otherVector.y, this.z - otherVector.z)
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    let len = this.length();
    if(len === 0) {
      return
    }
    let num = 1.0 / len
    this.x *= num
    this.y *= num
    this.z *= num
  }

  cross(vec1) {
    return new Vector3(
      this.y * vec1.z - this.z * vec1.y,
      this.z * vec1.x - this.x * vec1.z,
      this.x * vec1.y - this.y * vec1.x)
  }
}

export class Vector2 {
  x = 0
  y = 0

  static zero() {
    return new Vector2(0, 0)
  }

  constructor(x, y) {
    this.x = x
    this.y = y
  }

}

window.Matrix = Matrix
window.Vector3 = Vector3
