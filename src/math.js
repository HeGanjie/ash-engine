import { inv } from "mathjs";
import _, { chunk } from "lodash";
//import { mat4 } from "gl-matrix";
let weblas = window.weblas;

// import weblas from "weblas";
// let weblas = require("weblas");
let { sin, cos, tan, PI } = Math;

export function mat4MultVec3(mat4, vec3, w = 1) {
  let { data } = mat4;
  let { x, y, z } = vec3;
  let nextW = data[12] * x + data[13] * y + data[14] * z + data[15] * w;
  return new Vector3(
    (data[0] * x + data[1] * y + data[2] * z + data[3] * w) / nextW,
    (data[4] * x + data[5] * y + data[6] * z + data[7] * w) / nextW,
    (data[8] * x + data[9] * y + data[10] * z + data[11] * w) / nextW
  );
}

// row-major
export class Matrix {
  data = null;
  rowCount = 0;
  colCount = 0;

  constructor(arr, i, j) {
    if (arr.constructor.name === "Float32Array") {
      this.data = arr;
    } else if (arr[0].constructor.name === "Array") {
      this.data = weblas.util.fromArray(arr);
    } else {
      this.data = new Float32Array(i * j);
      for (let k = 0; k < arr.length; k++) {
        this.data[k] = arr[k];
      }
    }
    this.rowCount = i;
    this.colCount = j;
  }

  transpose() {
    let tr = weblas.util.transpose(this.rowCount, this.colCount, this.data);
    return new Matrix(tr, this.colCount, this.rowCount);
  }

  mul(m2) {
    if (4000 < m2.colCount) {
      let [mA, mB] = m2.splitCol(m2.colCount / 2).map(m => this.mul(m));
      return mA.concatCol(mB);
    }
    let v = weblas.sgemm(
      this.rowCount,
      m2.colCount,
      this.colCount,
      1.0,
      this.data,
      m2.data,
      0.0,
      null
    );
    return new Matrix(v, this.rowCount, m2.colCount);
  }

  splitCol(colCount) {
    let data0 = Array.from({ length: this.rowCount * colCount }, (v, i) => {
      let colIdx = i % colCount,
        rowIdx = Math.floor(i / colCount);
      return this.data[rowIdx * this.colCount + colIdx];
    });
    let rightPartLen = this.colCount - colCount;
    let data1 = Array.from({ length: this.rowCount * rightPartLen }, (v, i) => {
      let colIdx = i % rightPartLen,
        rowIdx = Math.floor(i / rightPartLen);
      return this.data[rowIdx * this.colCount + colIdx + colCount];
    });
    return [
      new Matrix(data0, this.rowCount, colCount),
      new Matrix(data1, this.rowCount, rightPartLen)
    ];
  }

  concatCol(m2) {
    let mergedColCount = this.colCount + m2.colCount;
    let mergedData = Array.from(
      { length: this.rowCount * mergedColCount },
      (v, i) => {
        let colIdx = i % mergedColCount,
          rowIdx = Math.floor(i / mergedColCount);
        if (colIdx < this.colCount) {
          return this.data[rowIdx * this.colCount + colIdx];
        }
        return m2.data[rowIdx * m2.colCount + colIdx - this.colCount];
      }
    );
    return new Matrix(mergedData, this.rowCount, mergedColCount);
  }

  scale(s) {
    let v = weblas.sscal(this.rowCount, this.colCount, s, 0.0, this.data);
    return new Matrix(v, this.rowCount, this.colCount);
  }

  add(a) {
    let v = weblas.sscal(this.rowCount, this.colCount, 1.0, a, this.data);
    return new Matrix(v, this.rowCount, this.colCount);
  }

  static eye(n) {
    let arr = new Float32Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        arr[i * n + j] = i === j ? 1 : 0;
      }
    }
    return new Matrix(arr, n, n);
  }

  addMatrix(m2) {
    let v = weblas.saxpy(this.rowCount * this.colCount, 1, this.data, m2.data);
    return new Matrix(v, this.rowCount, this.colCount);
  }

  static rotateX(theta) {
    return new Matrix(
      [
        1,
        0,
        0,
        0,
        0,
        cos(theta),
        -sin(theta),
        0,
        0,
        sin(theta),
        cos(theta),
        0,
        0,
        0,
        0,
        1
      ],
      4,
      4
    );
  }

  static rotateY(theta) {
    return new Matrix(
      [
        cos(theta),
        0,
        sin(theta),
        0,
        0,
        1,
        0,
        0,
        -sin(theta),
        0,
        cos(theta),
        0,
        0,
        0,
        0,
        1
      ],
      4,
      4
    );
  }

  static rotateZ(theta) {
    return new Matrix(
      [
        cos(theta),
        -sin(theta),
        0,
        0,
        sin(theta),
        cos(theta),
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1
      ],
      4,
      4
    );
  }

  static scaleXYZ(sx, sy, sz) {
    return new Matrix(
      [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1],
      4,
      4
    );
  }

  static transformXYZ(x, y, z) {
    return new Matrix([1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1], 4, 4);
  }

  static rotateXYZ(tx, ty, tz) {
    return Matrix.rotateZ(tz).mul(Matrix.rotateY(ty).mul(Matrix.rotateX(tx)));
  }

  static camera2World(cameraPos, lookAt, up0 = Vector3.up()) {
    let forward = cameraPos.subtract(lookAt);
    forward.normalize();
    let right = up0.cross(forward);
    right.normalize();
    let up = forward.cross(right);
    up.normalize();
    return new Matrix(
      [
        right.x,
        up.x,
        forward.x,
        cameraPos.x,
        right.y,
        up.y,
        forward.y,
        cameraPos.y,
        right.z,
        up.z,
        forward.z,
        cameraPos.z,
        0,
        0,
        0,
        1
      ],
      4,
      4
    );
  }

  // https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/building-basic-perspective-projection-matrix
  static perspectiveProjection = (fov, n, f) => {
    let S = 1 / tan(fov / 2),
      fnDist = f - n,
      m22 = -f / fnDist,
      m23 = -(f * n) / fnDist;
    return new Matrix(
      [S, 0, 0, 0, 0, S, 0, 0, 0, 0, m22, m23, 0, 0, -1, 0],
      4,
      4
    );
  };

  inv() {
    if (this.rowCount !== this.colCount) {
      throw new Error("inverse: this must be a square matrix");
    }
    let m = chunk(this.data, this.rowCount);
    let res = inv(m);
    return new Matrix(res, this.rowCount, this.colCount);
  }

  fromHomogeneous2CartesianCoords() {
    let arr = [],
      m = this,
      mArr = m.data;
    for (
      let j = 0, jy = m.colCount, jz = m.colCount * 2, jw = m.colCount * 3;
      j < m.colCount;
      j++, jy++, jz++, jw++
    ) {
      let mw = mArr[jw];
      arr.push(new Vector3(mArr[j] / mw, mArr[jy] / mw, mArr[jz] / mw));
    }
    return arr;
  }
}

export class Vector3 {
  x = 0;
  y = 0;
  z = 0;

  static zero() {
    return new Vector3(0, 0, 0);
  }

  static up() {
    return new Vector3(0, 1, 0);
  }

  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(vec3) {
    return new Vector3(this.x + vec3.x, this.y + vec3.y, this.z + vec3.z);
  }

  subtract(otherVector) {
    return new Vector3(
      this.x - otherVector.x,
      this.y - otherVector.y,
      this.z - otherVector.z
    );
  }

  scale(n) {
    return new Vector3(this.x * n, this.y * n, this.z * n);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    let len = this.length();
    if (len === 0) {
      return;
    }
    let num = 1.0 / len;
    this.x *= num;
    this.y *= num;
    this.z *= num;

    return len;
  }

  cross(vec1) {
    return new Vector3(
      this.y * vec1.z - this.z * vec1.y,
      this.z * vec1.x - this.x * vec1.z,
      this.x * vec1.y - this.y * vec1.x
    );
  }

  dot(v) {
    let { x, y, z } = this;
    return x * v.x + y * v.y + z * v.z;
  }
}

export class Vector2 {
  x = 0;
  y = 0;

  static zero() {
    return new Vector2(0, 0);
  }

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

// https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage
export function edgeFunction(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

window.Matrix = Matrix;
window.Vector3 = Vector3;
