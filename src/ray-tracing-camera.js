import {mat4, quat, vec2, vec3} from "gl-matrix";
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from "./shader-impl";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  resizeCanvasToDisplaySize,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatMap, flatten, isEqual, orderBy, sum, uniqBy, range} from "lodash";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  up = vec3.fromValues(0, 1, 0)
  fov = Math.PI / 2;
  rayTracingProgramInfo = null
  outputProgramInfo = null
  bufferInfo = null
  uniformDict = {}
  // 由于 webgl 限制不能同时读写同一个材质，所以用两个材质交替着读写
  offScreenTextures = []
  offScreenTextureWriteCursor = 0
  offScreenFrameBuffer = null
  renderCount = 0
  dataTexture = null
  dataTextureSize = [32, 32]
  prevPosition = this.position
  prevTarget = this.target
  beginTime = Date.now()
  exposure = 1.0

  constructor() {
  }

  createDataTexture(scene, gl) {
    // dataImageMeta: meshCount, meshMetaOffset, bvhNodeCount,bvhNodeOffset；
    //                materialCount, materialOffset, emitTriangleCount, emitTriangleOffset；vec4 * 2
    // meshMeta: data offset, triangleCount, materialID；vec4 * meshCount
    // mesh model mat4; world point * 3；uv * 3；world normal * 3；vec4 * (4 + 9 * n)
    // ...
    // bvhNode：boundMin；boundMax；leftNodeIdx, rightNodeIdx, child meshIdx, triangleIdx；vec4 * 3 * n
    // material：ID，roughness，metallic, type；albedo；emit intensity；vec4 * 3 * n
    // emit triangles：triangle area, meshIdx, faceIdx；vec4 * n

    const materials = orderBy(uniqBy(scene.meshes.map(m => m.material), m => m.id), m => m.id);
    const meshCount = scene.meshes.length;
    const meshMetaOffset = 2;
    const meshDataOffset = meshMetaOffset + meshCount;

    const quatTmp = quat.create();
    const mat4Tmp = mat4.create();
    const mat4Tmp2 = mat4.create()
    const vec3Tmp = vec3.create();
    const meshDataArr = scene.meshes.map(m => {
      const {rotation, position, scale, geometry} = m;
      const qRot = quat.fromEuler(quatTmp, ...rotation);
      const {faces, vertices, uvs, normals} = geometry
      const modelMat = mat4.fromRotationTranslationScale(mat4Tmp, qRot, position, scale);
      const mTransformForNormal = mat4.transpose(mat4Tmp2, mat4.invert(mat4Tmp2, modelMat))

      return [
        ...modelMat,
        ...flatMap(faces, f => {
          const indices = f.data;
          return [
            // vec4 point * 3
            ...flatMap(indices, d => {
              const worldPoint = vec3.transformMat4(vec3Tmp, vertices[d.V], modelMat)
              return [...worldPoint, 1];
            }),
            ...flatMap(indices, d => [...uvs[d.T], 0, 0]), // vec4 uv * 3
            // vec4 normals * 3
            ...flatMap(indices, d => {
              const worldNormal = vec3.transformMat4(vec3Tmp, normals[d.N], mTransformForNormal)
              return [...worldNormal, 1];
            })
          ]
        })
      ]
    })
    let meshOffset = meshDataOffset
    const meshMeta = flatMap(scene.meshes, (m, i) => {
      const currMeshOffset = meshOffset
      meshOffset += meshDataArr[i].length / 4
      return [currMeshOffset, m.geometry.faces.length, m.material.id, 0]
    })
    const bvhNodeCount = 0
    const bvhNodeOffset = meshOffset
    const materialCount = materials.length
    const materialOffset = bvhNodeOffset // TODO 考虑 bvh 数据
    const materialData = flatMap(materials, m => {
      const {r, g, b} = m.color
      const materialType = m.shaderImpl === SHADER_IMPLEMENT_STRATEGY.diffuseMap ? 0 : 1
      return [
        m.id, m.roughness ?? 1, m.metallic ?? 0, materialType,
        r, g, b, 1,
        ...m.selfLuminous, 0
      ]
    })
    const emitTrianglesData = flatMap(scene.meshes, (m, mIdx) => {
      if (!(m.material.selfLuminous[0] > 0)) {
        return []
      }
      return m.geometry.faces.map((f, fi) => [f.area, mIdx, fi, 0])
    })
    const emitTrianglesCount = emitTrianglesData.length
    const emitTriangleOffset = materialOffset + materialCount * 3
    const dataTextureData = [
      meshCount, meshMetaOffset, bvhNodeCount, bvhNodeOffset,
      materialCount, materialOffset, emitTrianglesCount, emitTriangleOffset,
      ...meshMeta,
      ...flatten(meshDataArr),
      // TODO bvh data
      ...materialData,
      ...flatten(emitTrianglesData)
    ];

    const {pow, ceil, log2, sqrt} = Math
    const textureWidth = pow(2, ceil(log2(sqrt(dataTextureData.length / 4))))
    const textureHeight = ceil(dataTextureData.length / 4 / textureWidth)
    this.dataTexture = gl.createTexture();
    this.dataTextureSize = [textureWidth, textureHeight]
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);

    // https://webgl2fundamentals.org/webgl/lessons/zh_cn/webgl-data-textures.html
    // gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // https://stackoverflow.com/questions/54276566/webgl-invalid-operation-teximage2d-arraybufferview-not-big-enough-for-reques/54276828
    const fullSize = textureWidth * textureHeight * 4
    const alignedTextureData = [...dataTextureData, ...range(fullSize - dataTextureData.length).map(() => 0)]
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, textureWidth, textureHeight, 0, gl.RGBA, gl.FLOAT, new Float32Array(alignedTextureData));
    // 设置筛选器，我们不需要使用贴图所以就不用筛选器了
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  initShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.rayTracing, {
      NUM_VERTICES_COUNT: scene.meshes.reduce((acc, m) => acc + m.geometry.vertices.length, 0),
      NUM_FACES_COUNT: scene.meshes.reduce((acc, m) => acc + m.geometry.faces.length, 0),
      NUM_MESHES_COUNT: scene.meshes.length,
      NUM_LIGHT_FACE_COUNT: scene.meshes.filter(m => m.material.selfLuminous[0] > 0)
        .reduce((acc, m) => acc + m.geometry.faces.length, 0),
      NUM_MATERIALS_COUNT: uniqBy(scene.meshes.map(m => m.material), m => m.id).length
    })
    this.rayTracingProgramInfo = createProgramInfo(gl, [vert, frag])

    this.createDataTexture(scene, gl)

    // TODO 窗口大小变化时重置贴图大小
    // 创建纹理，用于累加计算，创建
    // 定义 0 级的大小和格式
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    this.offScreenTextures[0] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.offScreenTextures[0]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, gl.canvas.width, gl.canvas.height, border, format, type, data);
    // 设置筛选器，不需要使用贴图
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.offScreenTextures[1] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.offScreenTextures[1]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, gl.canvas.width, gl.canvas.height, border, format, type, data);
    // 设置筛选器，不需要使用贴图
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.offScreenTextureWriteCursor = 0
    // 创建并绑定帧缓冲
    this.offScreenFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.offScreenFrameBuffer);
    // 附加纹理为第一个颜色附件
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.offScreenTextures[this.offScreenTextureWriteCursor], level);
  }

  initRenderTextureShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.renderTexture, {})
    this.outputProgramInfo = createProgramInfo(gl, [vert, frag])
  }

  initBuffer(scene, gl) {
    // 裁剪空间的坐标范围永远是 -1 到 1，https://webglfundamentals.org/webgl/lessons/zh_cn/webgl-fundamentals.html

    let vertices = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    let arrays = {
      position: {
        numComponents: 2,
        data: flatten(vertices)
      },
      indices:  {
        numComponents: 3,
        data: [
          0, 1, 2,
          2, 3, 0
        ]
      },
    };

    const bufferInfo = createBufferInfoFromArrays(gl, arrays)
    this.bufferInfo = bufferInfo
  }

  renderRayTracing(scene, gl) {
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.offScreenFrameBuffer);
    // 附加纹理为第一个颜色附件
    const level = 0;
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.offScreenTextures[this.offScreenTextureWriteCursor], level);

    // 视角变化后需要重置 renderCount
    if (!isEqual(this.position, this.prevPosition) || !isEqual(this.target, this.prevTarget)) {
      this.renderCount = 0
    }
    vec3.copy(this.prevPosition, this.position)
    vec3.copy(this.prevTarget, this.target)
    if (this.renderCount === 0) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    if (!this.rayTracingProgramInfo) {
      this.initShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.useProgram(this.rayTracingProgramInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_resolution = vec2.set(uniformDict.u_resolution || vec2.create(), gl.canvas.width, gl.canvas.height)
    uniformDict.u_eye_pos = this.position
    uniformDict.u_fov = this.fov
    uniformDict.u_cam_to_world = mat4.targetTo(uniformDict.u_cam_to_world || mat4.create(), this.position, this.target, this.up)

    uniformDict.u_areaOfLightFace = uniformDict.u_areaOfLightFace || flatMap(scene.meshes, m => {
      return m.material.selfLuminous[0] <= 0 ? [] : m.geometry.faces.map(f => f.area)
    })
    uniformDict.u_areaOfLightSum = uniformDict.u_areaOfLightSum || sum(uniformDict.u_areaOfLightFace)
    uniformDict.u_ran = vec2.set(uniformDict.u_ran || vec2.create(), Math.random(), Math.random())
    uniformDict.u_prevResult = this.offScreenTextures[(this.offScreenTextureWriteCursor + 1) % 2]
    uniformDict.u_data_texture = this.dataTexture
    uniformDict.u_data_texture_width = this.dataTextureSize[0]
    uniformDict.u_renderCount = this.renderCount++
    uniformDict.u_time = (Date.now() - this.beginTime) / 1000
    uniformDict.u_exposure = this.exposure

    setUniforms(this.rayTracingProgramInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.rayTracingProgramInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }

  renderTexture(scene, gl) {
    if (!this.outputProgramInfo) {
      this.initRenderTextureShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(this.outputProgramInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_offScreenTexture = this.offScreenTextures[this.offScreenTextureWriteCursor]

    setUniforms(this.outputProgramInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.outputProgramInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }

  render(scene, gl) {
    // 渲染到光线跟踪累加贴图
    this.renderRayTracing(scene, gl)

    // 把累加贴图渲染到 canvas
    this.renderTexture(scene, gl)

    this.offScreenTextureWriteCursor = (this.offScreenTextureWriteCursor + 1) % 2
  }
}
