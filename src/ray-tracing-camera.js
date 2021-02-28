import {vec3, mat4, vec2, quat} from "gl-matrix";
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from "./shader-impl";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  resizeCanvasToDisplaySize,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatten, flatMap, uniqBy, sum} from "lodash";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  up = vec3.fromValues(0, 1, 0)
  fov = Math.PI / 2;
  programInfo = null
  bufferInfo = null
  uniformDict = {}

  constructor() {
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
    this.programInfo = createProgramInfo(gl, [vert, frag])
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

  render(scene, gl) {
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    if (!this.programInfo) {
      this.initShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.useProgram(this.programInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_resolution = vec2.set(uniformDict.u_resolution || vec2.create(), gl.canvas.width, gl.canvas.height)
    uniformDict.u_eye_pos = this.position
    uniformDict.u_fov = this.fov
    uniformDict.u_cam_to_world = mat4.targetTo(uniformDict.u_cam_to_world || mat4.create(), this.position, this.target, this.up)
    // TODO optimize gc
    uniformDict.u_vertices = uniformDict.u_vertices || flatMap(scene.meshes, m => flatMap(m.geometry.vertices, v => [...v]))
    let verticesOffset = 0
    uniformDict.u_indices = uniformDict.u_indices || flatMap(scene.meshes, m => {
      let result = flatMap(m.geometry.faces, f => f.data.map(d => d.V + verticesOffset));
      verticesOffset += m.geometry.vertices.length
      return result
    })
    uniformDict.u_face_normals = uniformDict.u_face_normals || flatMap(scene.meshes, m => {
      return flatMap(m.geometry.faces, f => [...f.normal])
    })
    uniformDict.u_face_material_ids = uniformDict.u_face_material_ids || flatMap(scene.meshes, m => {
      return m.geometry.faces.map(() => m.material.id);
    })
    uniformDict.u_local_to_world_matrixs = uniformDict.u_local_to_world_matrixs || flatMap(scene.meshes, m => {
      let {rotation, position, scale} = m;
      let qRot = quat.fromEuler(quat.create(), ...rotation)
      return [...mat4.fromRotationTranslationScale(mat4.create(), qRot, position, scale)]
    })
    uniformDict.u_material_colors = uniformDict.u_material_colors || flatMap(uniqBy(scene.meshes.map(m => m.material), m => m.id), m => {
      let {r, g, b} = m.color
      return [r, g, b]
    })
    uniformDict.u_material_emits = uniformDict.u_material_emits || flatMap(uniqBy(scene.meshes.map(m => m.material), m => m.id), m => {
      return [...m.selfLuminous]
    })
    let faceOffset = 0
    uniformDict.u_lightFaceIdx = uniformDict.u_lightFaceIdx || flatMap(scene.meshes, m => {
      let res = m.material.selfLuminous[0] <= 0 ? [] : m.geometry.faces.map((f, fi) => faceOffset + fi)
      faceOffset += m.geometry.faces.length
      return res
    })
    uniformDict.u_areaOfLightFace = uniformDict.u_areaOfLightFace || flatMap(scene.meshes, m => {
      return m.material.selfLuminous[0] <= 0 ? [] : m.geometry.faces.map(f => f.area)
    })
    uniformDict.u_areaOfLightSum = uniformDict.u_areaOfLightSum || sum(uniformDict.u_areaOfLightFace)
    uniformDict.u_ran = vec2.set(uniformDict.u_ran || vec2.create(), Math.random(), Math.random())

    setUniforms(this.programInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.programInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }
}
