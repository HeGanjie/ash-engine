import { Vector3, Vector2, Matrix, edgeFunction } from "./math";
import { zip, flatMap, isEmpty, round, clone, isEqual } from "lodash";
import { defaultColor, Ray } from "./engine";

let { PI, tan, floor, ceil, min, max } = Math;

const targetTextureWidth = 256;
const targetTextureHeight = 256;
const renderShadowMap = false;

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

  webglOrthographicProjectionMatrix(t, b, l, r, n, f) {
    let r_l = r - l,
      t_b = t - b,
      f_n = f - n;
    return new Matrix(
      [
        2 / r_l,
        0,
        0,
        -(r + l) / r_l,
        0,
        2 / t_b,
        0,
        -(t + b) / t_b,
        0,
        0,
        -2 / f_n,
        -(f + n) / f_n,
        0,
        0,
        0,
        1
      ],
      4,
      4
    );
  }

  initShader(scene, gl) {
    let vertexShaderSource = `
      attribute vec4 a_position;
      uniform mat4 u_matrix;
      uniform mat4 u_shadowMapMatrix;
      attribute vec3 a_normal;
      uniform mat4 u_normalTransform;

      varying vec3 v_normal;
      varying vec3 v_shadowMapPos;

      void main() {
        gl_Position = u_matrix * a_position;
        v_shadowMapPos = vec3(u_shadowMapMatrix * a_position);
        // 将法向量传到片断着色器
        v_normal = mat3(u_normalTransform) * a_normal;
      }
    `;
    let fragmentShaderSource = `
      precision mediump float;
      varying vec3 v_normal;
      uniform vec3 u_reverseLightDirection;

      varying vec3 v_shadowMapPos; // xy -> uv, z -> depth
      uniform sampler2D u_texShadowMap;

      void main() {
        vec2 v_texcoord = v_shadowMapPos.xy * 0.5 + 0.5;
        vec4 shadowMapColor = texture2D(u_texShadowMap, v_texcoord);
        float depthInLightSpace = shadowMapColor.r; // 如果被遮挡的话，这个值比较小
        float depthCalc = v_shadowMapPos.z;
        float illuminated = step(depthCalc, depthInLightSpace + 0.001); // depthCalc <= depthInLightSpace + 0.001 ? 1 : 0

        // 由于 v_normal 是插值出来的，和有可能不是单位向量，
        // 可以用 normalize 将其单位化。
        vec3 normal = normalize(v_normal);
        float light = dot(normal, u_reverseLightDirection);
        gl_FragColor = vec4(1, 1, 1, 1);
        // 将颜色部分（不包括 alpha）和 光照相乘
        gl_FragColor.rgb *= light * illuminated;
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
    var shadowMapMatrixLocation = gl.getUniformLocation(
      program,
      "u_shadowMapMatrix"
    );
    var normalTransformMatrixLocation = gl.getUniformLocation(
      program,
      "u_normalTransform"
    );
    var reverseLightDirectionLocation = gl.getUniformLocation(
      program,
      "u_reverseLightDirection"
    );
    var texShadowMapLocation = gl.getUniformLocation(program, "u_texShadowMap");

    let positionBuffers = scene.meshes.map(mesh => {
      var positionBuffer = gl.createBuffer();
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
      return positionBuffer;
    });

    let normalBuffers = scene.meshes.map(mesh => {
      let { faces, normals } = mesh;
      var normalBuffer = gl.createBuffer();
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
      return normalBuffer;
    });

    this.webglConf = {
      program,
      positionAttributeLocation,
      normalLocation,
      matrixLocation,
      shadowMapMatrixLocation,
      normalTransformMatrixLocation,
      reverseLightDirectionLocation,
      texShadowMapLocation,
      positionBuffers,
      normalBuffers
    };
  }

  initShadowMapShader(scene, gl) {
    let vertexShaderSource = `
      attribute vec4 a_position;
      uniform mat4 u_matrix;

      void main() {
        gl_Position = u_matrix * a_position;
      }
    `;
    let fragmentShaderSource = `
      precision mediump float;

      void main() {
        gl_FragColor = vec4(gl_FragCoord.zzz, 1.0);
        // gl_FragDepth = gl_FragCoord.z;
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
    var matrixLocation = gl.getUniformLocation(program, "u_matrix");

    let positionBuffers = scene.meshes.map(mesh => {
      var positionBuffer = gl.createBuffer();
      let { vertices, faces } = mesh;
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
      return positionBuffer;
    });

    if (renderShadowMap) {
      this.shadowMapConf = {
        program,
        positionAttributeLocation,
        matrixLocation,
        positionBuffers
      };
      return;
    }

    // 创建渲染对象
    const targetTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);

    {
      // 定义 0 级的大小和格式
      const level = 0;
      const internalFormat = gl.RGBA;
      const border = 0;
      const format = gl.RGBA;
      const type = gl.UNSIGNED_BYTE;
      const data = null;
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        targetTextureWidth,
        targetTextureHeight,
        border,
        format,
        type,
        data
      );

      // 设置筛选器，不需要使用贴图
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      targetTexture,
      0
    );

    this.shadowMapConf = {
      program,
      positionAttributeLocation,
      matrixLocation,
      positionBuffers,
      targetTexture,
      frameBuffer
    };
  }

  renderShadowMap(scene, gl) {
    if (!this.shadowMapConf) {
      this.initShadowMapShader(scene, gl);
    }
    let {
      program,
      positionAttributeLocation,
      matrixLocation,
      positionBuffers,
      targetTexture,
      frameBuffer
    } = this.shadowMapConf;
    // 计算 world to light space 矩阵
    // 计算平面投影矩阵（先要取得 l, r, t, b, n, f）
    // 绘制 shadowMap
    let { meshes, lights } = scene;
    let { direction: lightDirection } = lights[0];
    let l2w = Matrix.camera2World(lightDirection.scale(-3), lightDirection),
      w2l = l2w.inv(); // 4 * 4
    let orthProjMatrix = this.webglOrthographicProjectionMatrix(
      6,
      -6,
      -6,
      6,
      1,
      5.5
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(program);

    let op_w2l = orthProjMatrix.mul(w2l);
    this.shadowMapConf.op_w2l = op_w2l;

    for (let i = 0; i < meshes.length; i++) {
      let mesh = meshes[i];
      let { rotation, position } = mesh;
      let mRo = Matrix.rotateXYZ(rotation.x, rotation.y, rotation.z);
      let mTr = Matrix.transformXYZ(position.x, position.y, position.z);
      let op_w2l_transform = op_w2l.mul(mRo.mul(mTr));

      gl.uniformMatrix4fv(
        matrixLocation,
        false,
        op_w2l_transform.transpose().data
      );

      {
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);

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

      let primitiveType = gl.TRIANGLES;
      let offset = 0;
      let count = mesh.faces.length * 3;
      gl.drawArrays(primitiveType, offset, count);
    }
  }

  render(scene, gl, fov = PI / 2) {
    if (renderShadowMap) {
      return this.renderShadowMap(scene, gl);
    }

    if (!this.webglConf) {
      this.initShader(scene, gl);
    }
    this.renderShadowMap(scene, gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let {
      program,
      positionAttributeLocation,
      normalLocation,
      matrixLocation,
      shadowMapMatrixLocation,
      normalTransformMatrixLocation,
      reverseLightDirectionLocation,
      texShadowMapLocation,
      positionBuffers,
      normalBuffers
    } = this.webglConf;
    let { targetTexture, op_w2l } = this.shadowMapConf;
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
    gl.uniform1i(texShadowMapLocation, 0);

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
      let { rotation, position } = mesh;
      let mRo = Matrix.rotateXYZ(rotation.x, rotation.y, rotation.z);
      let mTr = Matrix.transformXYZ(position.x, position.y, position.z);
      let transformMatrix = mRo.mul(mTr);
      let pp_w2c_transform = pp_w2c.mul(transformMatrix);
      let op_w2l_transform = op_w2l.mul(transformMatrix);

      gl.uniformMatrix4fv(
        matrixLocation,
        false,
        pp_w2c_transform.transpose().data
      );
      gl.uniformMatrix4fv(
        shadowMapMatrixLocation,
        false,
        op_w2l_transform.transpose().data
      );
      gl.uniformMatrix4fv(
        normalTransformMatrixLocation,
        false,
        w2c.mul(mRo).inv().data
      );

      {
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);

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
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[i]);

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
      let count = mesh.faces.length * 3;
      gl.drawArrays(primitiveType, offset, count);
    }
  }
}
