let weblas = window.weblas

export class Matrix {
  data = null
  rowCount = 0
  colCount = 0

  constructor(arr, i, j) {
    if (arr.constructor.name === 'Float32Array') {
      this.data = arr
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
}

export class Vector3 {
  x = 0
  y = 0
  z = 0

  static zero() {
    return new Vector3(0, 0, 0)
  }

  constructor(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }
}