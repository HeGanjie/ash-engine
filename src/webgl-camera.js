import { Vector3, Vector2, Matrix, edgeFunction } from "./math";
import { zip, flatMap, isEmpty, round, clone, isEqual } from "lodash";
import { defaultColor, Ray } from "./engine";

let { PI, tan, floor, ceil, min, max } = Math;

// 创建着色器方法，输入参数：渲染上下文，着色器类型，数据源
function createShader(gl, type, source) {
  var shader = gl.createShader(type); // 创建着色器对象
  gl.shaderSource(shader, source); // 提供数据源
  gl.compileShader(shader); // 编译 -> 生成着色器
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

export class Camera {
  width = 400;
  height = 300;
  position = Vector3.zero();
  target = Vector3.zero();
  nearClippingPlaneDistance = 0.1;
  farClippingPlaneDistance = 1000;

  constructor(
    width,
    height,
    nearClippingPlaneDistance = 0.1,
    farClippingPlaneDistance = 1000
  ) {
    this.width = width;
    this.height = height;
    this.nearClippingPlaneDistance = nearClippingPlaneDistance;
    this.farClippingPlaneDistance = farClippingPlaneDistance;
  }

  webglPerspectiveProjectionMatrix(fovY, near, far) {
    let aspectRatio = this.width / this.height,
      top = tan(fovY / 2) * near,
      bottom = -top,
      right = top * aspectRatio,
      left = -right;
    let r_l = right - left,
      t_b = top - bottom,
      f_n = far - near;

    return new Matrix(
      [
        (2 * near) / r_l,
        0,
        (right + left) / r_l,
        0,
        0,
        (2 * near) / t_b,
        (top + bottom) / t_b,
        0,
        0,
        0,
        -(far + near) / f_n,
        (-2 * far * near) / f_n,
        0,
        0,
        -1,
        0
      ],
      4,
      4
    );
  }

  initShader(gl) {
    let vertexShaderSource = `
      attribute vec4 a_position;
      uniform mat4 u_matrix;
      attribute vec3 a_normal;
      uniform mat4 u_normalTransform;

      varying vec3 v_normal;

      void main() {
        gl_Position = u_matrix * a_position;
        // 将法向量传到片断着色器
        v_normal = mat3(u_normalTransform) *a_normal;
      }
    `;
    let fragmentShaderSource = `
      precision mediump float;
      varying vec3 v_normal;
      uniform vec3 u_reverseLightDirection;

      void main() {
        // 由于 v_normal 是插值出来的，和有可能不是单位向量，
        // 可以用 normalize 将其单位化。
        vec3 normal = normalize(v_normal);
        float light = dot(normal, u_reverseLightDirection);
        gl_FragColor = vec4(1, 1, 1, 1);
        // 将颜色部分（不包括 alpha）和 光照相乘
        gl_FragColor.rgb *= light;
      }
    `;
    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );
    var program = createProgram(gl, vertexShader, fragmentShader);

    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    var normalLocation = gl.getAttribLocation(program, "a_normal");
    var matrixLocation = gl.getUniformLocation(program, "u_matrix");
    var normalTransformMatrixLocation = gl.getUniformLocation(
      program,
      "u_normalTransform"
    );
    var reverseLightDirectionLocation = gl.getUniformLocation(
      program,
      "u_reverseLightDirection"
    );
    var positionBuffer = gl.createBuffer();
    var normalBuffer = gl.createBuffer();

    // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // 三个二维点坐标
    // var positions = [0, 0, 0, 0.5, 0.7, 0];
    // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    this.webglConf = {
      program,
      positionAttributeLocation,
      normalLocation,
      matrixLocation,
      normalTransformMatrixLocation,
      reverseLightDirectionLocation,
      positionBuffer,
      normalBuffer
    };
  }

  render(scene, gl, fov = PI / 2) {
    if (!this.webglConf) {
      this.initShader(gl);
    }
    let {
      program,
      positionAttributeLocation,
      normalLocation,
      matrixLocation,
      normalTransformMatrixLocation,
      reverseLightDirectionLocation,
      positionBuffer,
      normalBuffer
    } = this.webglConf;
    //webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(program);

    // 设置光线方向
    let [distantLight] = scene.lights;
    let shadowLightDir = distantLight.getShadowLightDirection();
    shadowLightDir.normalize();
    gl.uniform3fv(reverseLightDirectionLocation, [
      shadowLightDir.x,
      shadowLightDir.y,
      shadowLightDir.z
    ]);

    let c2w = Matrix.camera2World(this.position, this.target); // 4 * 4
    let w2c = c2w.inv();
    let perspectiveProjectionMatrix = this.webglPerspectiveProjectionMatrix(
      fov,
      1,
      20
    );
    let pp_w2c = perspectiveProjectionMatrix.mul(w2c);

    for (let i = 0; i < scene.meshes.length; i++) {
      let mesh = scene.meshes[i];
      let mRo = Matrix.rotateXYZ(
        mesh.rotation.x,
        mesh.rotation.y,
        mesh.rotation.z
      );
      let mTr = Matrix.transformXYZ(
        mesh.position.x,
        mesh.position.y,
        mesh.position.z
      );
      let finalMatrix = pp_w2c.mul(mRo.mul(mTr));

      gl.uniformMatrix4fv(matrixLocation, false, finalMatrix.transpose().data);
      gl.uniformMatrix4fv(
        normalTransformMatrixLocation,
        false,
        w2c.mul(mRo).inv().data
      );

      let { vertices, faces, normals } = mesh;

      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let positions = flatMap(faces, f => {
        let vA = vertices[f.A],
          vB = vertices[f.B],
          vC = vertices[f.C];
        return [vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z];
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      );

      let normalPositions = flatMap(faces, f => {
        let vAN = normals[f.AN],
          vBN = normals[f.BN],
          vCN = normals[f.CN];
        return [vAN.x, vAN.y, vAN.z, vBN.x, vBN.y, vBN.z, vCN.x, vCN.y, vCN.z];
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(normalPositions),
        gl.STATIC_DRAW
      );

      {
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // 告诉属性怎么从positionBuffer中读取数据 (ARRAY_BUFFER)
        let size = 3; // 每次迭代运行提取两个单位数据
        let type = gl.FLOAT; // 每个单位的数据类型是32位浮点型
        let normalize = false; // 不需要归一化数据
        let stride = 0; // 0 = 移动单位数量 * 每个单位占用内存（sizeof(type)）
        // 每次迭代运行运动多少内存到下一个数据开始点
        let offset = 0; // 从缓冲起始位置开始读取
        gl.vertexAttribPointer(
          positionAttributeLocation,
          size,
          type,
          normalize,
          stride,
          offset
        );
      }

      {
        gl.enableVertexAttribArray(normalLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

        // Tell the attribute how to get data out of normalBuffer (ARRAY_BUFFER)
        let size = 3; // 3 components per iteration
        let type = gl.FLOAT; // the data is 32bit floating point values
        let normalize = false; // normalize the data (convert from 0-255 to 0-1)
        let stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
        let offset = 0; // start at the beginning of the buffer
        gl.vertexAttribPointer(
          normalLocation,
          size,
          type,
          normalize,
          stride,
          offset
        );
      }

      let primitiveType = gl.TRIANGLES;
      let offset = 0;
      let count = positions.length / 3;
      gl.drawArrays(primitiveType, offset, count);
    }
  }
}
