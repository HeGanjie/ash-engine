import {mat4, quat, vec2, vec3} from 'gl-matrix'
import _, {cloneDeep, every, filter} from 'lodash'
import earcut from 'earcut'
import {DistantLight} from './distant-light'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'
import {faceVerticesPropNameDict} from './constants'
import sphere from 'primitive-sphere'
import plane from 'primitive-plane'
import cube from 'primitive-cube'
import {calcAreaOfTriangle} from "./utils";
import {calcAABBox, flattenBvhNode, recursiveBuild} from "./bvh";

window.earcut = earcut
window.vec3 = vec3
window.mat4 = mat4
window.quat = quat
window._ = _


export const defaultColor = { r: 1, g: 1, b: 1 };

const xyPanelNormal = vec3.fromValues(0, 0, 1);
const xzPanelNormal = vec3.fromValues(0, 1, 0);
const vec3Zero = vec3.fromValues(0, 0, 0);
function getXYPlantVerticesPosForFace(face, faceNormal, vertices) {
  let needRotate = vec3.dot(faceNormal, xyPanelNormal) < 0.9;
  let transformedVec3Arr;
  if (needRotate) {
    let needRotateUpVec = 0.95 < Math.abs(vec3.dot(faceNormal, xzPanelNormal));
    let up = needRotateUpVec ? vec3.fromValues(0, 0, -1) : vec3.fromValues(0, 1, 0);
    let w2c = mat4.lookAt(mat4.create(), faceNormal, vec3Zero, up)
    transformedVec3Arr = face.data.map(({V}) => vec3.transformMat4(vec3.create(), vertices[V], w2c));
  } else {
    transformedVec3Arr = face.data.map(({V}) => vertices[V]);
  }
  return transformedVec3Arr
}

async function mergeImgs(mainTextureWidth, mainTextureHeight, idealArrangement) {
  let canvas = document.createElement('canvas');
  canvas.width = mainTextureWidth;
  canvas.height = mainTextureHeight;
  let ctx = canvas.getContext("2d");
  let y = 0
  idealArrangement.forEach(layer => {
    let x = 0
    layer.forEach(img => {
      ctx.drawImage(img, x, y)
      x += img.width
    })
    y += layer[0].height
  })

  return await new Promise(resolve => {
    const image = new Image()
    image.src = canvas.toDataURL("image/png")

    image.onload = () => resolve(image)
  })
}

export function fromStackGlPrimitive(obj) {
  // cells: [[0, 1, 2], [2, 3, 0]]
  // normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]]
  // positions: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]]
  // uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
  const {positions, cells, uvs, normals} = obj

  let faceNormals = cells.map(cell => {
    let [v0, v1, v2] = cell.map(vi => positions[vi])
    let v01 = vec3.subtract(vec3.create(), v1, v0)
    let v12 = vec3.subtract(vec3.create(), v2, v1)
    let normal = vec3.cross(vec3.create(), v01, v12)
    vec3.normalize(normal, normal)
    return normal
  })

  return new Geometry({
    vertices: positions.map(p => vec3.fromValues(...p)),
    normals: normals.map(n => vec3.fromValues(...n)),
    uvs: uvs.map(uv => vec2.fromValues(...uv)),
    faces: cells.map((c, ci) => {
      return {
        data: c.map(vi => ({V: vi, N: vi, T: vi})),
        normal: faceNormals[ci],
        area: calcAreaOfTriangle(...c.map(vi => positions[vi]))
      }
    })
  })
}

function calcTangent(v0, v1, v2, uv0, uv1, uv2) {
  let edge1 = vec3.subtract(vec3.create(), v1, v0)
  let edge2 = vec3.subtract(vec3.create(), v2, v0)
  let deltaUV1 = vec2.subtract(vec2.create(), uv1, uv0)
  let deltaUV2 = vec2.subtract(vec2.create(), uv2, uv0)

  let fa = 1 / (deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1]);
  let tangent = vec3.fromValues(
    fa * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]),
    fa * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]),
    fa * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2])
  )
  return vec3.normalize(tangent, tangent)
}

export class Geometry {
  vertices = null
  normals = null
  faces = null
  uvs = null
  tangents = null // 自动根据法线和 uv 生成

  constructor(opts) {
    Object.assign(this, opts)
    if (!this.tangents) {
      this.calcTangents()
    }
  }

  calcTangents() {
    if (!this.normals || !this.uvs) {
      throw new Error('Can not generate tangents without normals and uvs')
    }
    let vertexFaceIndexDict = _(this.faces)
      .map((f, fi) => ({faceIndex: fi, indices: f.data.map(d => d.V)}))
      .flatMap(info => info.indices.map(vi => ({faceIndex: info.faceIndex, vertexIndex: vi})))
      .groupBy(info => info.vertexIndex)
      .mapValues(infos => infos.map(inf => inf.faceIndex))
      .value()
    this.tangents = this.normals.map((n, vi) => {
      // 找出全部临近面
      let faces = vertexFaceIndexDict[vi].map(faceIdx => this.faces[faceIdx])
      // 算出全部面的切线
      let tangentsOfFaces = faces.map(f => {
        if (f.tangent) {
          return f.tangent
        }
        let [v0, v1, v2] = f.data.map(d => this.vertices[d.V])
        const uvs = f.data.map(d => this.uvs[d.T]);
        let [uv0, uv1, uv2] = uvs

        f.tangent = every(uvs, uv => uv[0] === 0 && uv[1] === 0)
          ? vec3.fromValues(0, 0, 0)
          : calcTangent(v0, v1, v2, uv0, uv1, uv2)
        return f.tangent
      })
      // 通过求平均算出点的切线 TODO 插值?

      let meanTangent = tangentsOfFaces.reduce((acc, curr) => vec3.add(acc, acc, curr), vec3.create())

      vec3.normalize(meanTangent, meanTangent)
      return meanTangent
    })
  }

  transform(rotate, move = vec3.fromValues(0, 0, 0), scale = vec3.fromValues(1, 1, 1)) {
    // TODO 优化性能
    let qRot = quat.fromEuler(quat.create(), ...rotate)
    let mTransform = mat4.fromRotationTranslationScale(mat4.create(), qRot, move, scale);
    let mTransformForNormal = mat4.create()
    mat4.transpose(mTransformForNormal, mat4.invert(mTransformForNormal, mTransform))
    return new Geometry({
      vertices: this.vertices.map(pos => vec3.transformMat4(vec3.create(), pos, mTransform)),
      normals: this.normals.map(dir => {
        const n0 = vec3.transformMat4(vec3.create(), dir, mTransformForNormal)
        return vec3.normalize(n0, n0)
      }),
      faces: cloneDeep(this.faces),
      uvs: this.uvs,
      tangents: this.tangents.map(dir => {
        const n0 = vec3.transformMat4(vec3.create(), dir, mTransformForNormal)
        return vec3.normalize(n0, n0)
      })
    })
  }

  static parseObj(objFileContent) {
    const lines = objFileContent.split(/\s*\r?\n/);
    let positions = filter(lines, line => line[0] === 'v')
      .map(line => {
        let m = line.match(/^v\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/)
        if (!m) {
          throw new Error(`malformed input: ${line}`)
        }
        return [+m[1], +m[2], +m[3]]
      })
    let cells = filter(lines, line => line[0] === 'f')
      .map(line => {
        let m = line.match(/^f\s+(\d+)\s+(\d+)\s+(\d+)\s*$/)
        if (!m) {
          throw new Error(`malformed input: ${line}`)
        }
        return [m[1] - 1, m[2] - 1, m[3] - 1]
      })
    // TODO 如果没有给定点法线，则根据面信息设置法线
    let pointNormals = []
    let uvs = []
    let faceNormals = cells.map(cell => {
      let [v0, v1, v2] = cell.map(vi => positions[vi])
      let v01 = vec3.subtract(vec3.create(), v1, v0)
      let v12 = vec3.subtract(vec3.create(), v2, v1)
      let normal = vec3.cross(vec3.create(), v01, v12)
      vec3.normalize(normal, normal)
      return normal
    })

    // 按照这个规范来生成几何体
    // cells: [[0, 1, 2], [2, 3, 0]]
    // normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]]
    // positions: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]]
    // uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    return new Geometry({
      vertices: positions.map(p => vec3.fromValues(...p)),
      normals: _.isEmpty(pointNormals)
        ? positions.map((p, i) => faceNormals[_.findIndex(cells, cell => _.includes(cell, i))])
        : _.map(pointNormals, n => vec3.fromValues(...n)),
      uvs: _.isEmpty(uvs) ? positions.map(() => vec2.fromValues(0, 0)) : _.map(uvs, uv => vec2.fromValues(...uv)),
      faces: cells.map((c, ci) => {
        return {
          data: c.map(vi => ({V: vi, N: vi, T: vi})),
          // 新属性
          normal: faceNormals[ci],
          area: calcAreaOfTriangle(...c.map(vi => positions[vi]))
        }
      })
    })
  }

  static SphereGeometry = fromStackGlPrimitive(sphere(1, {segments: 16}))

  static TrianglePlaneGeometry = new Geometry({
    vertices: [
      vec3.fromValues(0.5, 0, 0),
      vec3.fromValues(0, 0.5, 0),
      vec3.fromValues(-0.5, 0, 0),
    ],
    normals: [
      vec3.fromValues(0, 1, 0),
      vec3.fromValues(0, 1, 0),
      vec3.fromValues(0, 1, 0)
    ],
    faces: [
      { data:  [{V: 0, N: 0, T: 0}, {V: 1, N: 0, T: 1}, {V: 2, N: 0, T: 2}] }
    ],
    uvs: [
      vec2.fromValues(1, 0),
      vec2.fromValues(0.5, 1),
      vec2.fromValues(0, 0)
    ]
  })

  static QuadGeometry = fromStackGlPrimitive(plane())

  static CubeGeometry = fromStackGlPrimitive(cube())

  triangulation() {
    let {faces, vertices, normals} = this
    if (faces[0].triangleIndices) {
      return
    }
    faces.forEach((f, fi) => {
      // 如果只有三个点则无需转换
      if (f.data.length === 3) {
        f.triangleIndices = f.data.map(d => d.V)
        // f.triangleIndicesForVertexes = f.triangleIndices.map(ti => f.data[ti].V)
        return
      }
      // do triangulation after rotate face to x-y plane
      let transformedVec3Arr = getXYPlantVerticesPosForFace(f, normals[f.data[0].N], vertices)
      let vPos = _.flatMap(transformedVec3Arr, vArr => [...vArr]);
      // [2, 3, 0, 0, 1, 2]
      const currTriangleIndices = earcut(vPos, null, 3)
      f.triangleIndices = currTriangleIndices.map(ti => f.data[ti].V);
      if (_.isEmpty(f.triangleIndices)) {
        throw new Error('triangulation error: ' + f)
      }
      // f.triangleIndicesForVertexes = currTriangleIndices.map(ti => f.data[ti].V)
    })
  }

}

const tempCanvas = document.createElement('canvas');
tempCanvas.width = 32;
tempCanvas.height = 32;
const tempCanvasCtx = tempCanvas.getContext("2d");

export function makeImage(color, width = 2, height = 2) {
  tempCanvas.width = width;
  tempCanvas.height = height;
  let {r, g, b, a} = color
  tempCanvasCtx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a || 1})`;
  tempCanvasCtx.fillRect(0, 0, width, height);
  let resImg = new Image()
  resImg.src = tempCanvas.toDataURL("image/png")
  return resImg
}

export const fillBlackMap = makeImage({r: 0, g: 0, b: 0, a: 1})
export const fillWhiteMap = makeImage({r: 1, g: 1, b: 1, a: 1})
const defaultNormalMap = makeImage({r: 0.5, g: 0.5, b: 1, a: 1})

export class Material {
  diffuseMap = null // Image or TODO Image[]
  specularMap = null
  normalMap = null // null then always face normal
  albedo = 0.18;
  kS = 0.02; // phong model specular weight
  specularExp = 1;   // phong specular exponent
  selfLuminous = vec3.create();

  diffuseMapTexcoords = null; // auto gen
  specularMapTexcoords = null;
  normalMapTexcoords = null;

  shaderImpl = null;

  constructor(opts) {
    Object.assign(this, opts)
    // if no diffuseMap but color, convert color to img
    if (!this.diffuseMap && opts.color) {
      let {r, g, b, a} = opts.color
      tempCanvasCtx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a || 1})`;
      tempCanvasCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      this.diffuseMap = new Image()
      this.diffuseMap.src = tempCanvas.toDataURL("image/png")
    }
    this.specularMap = this.specularMap || fillBlackMap
    this.normalMap = this.normalMap || defaultNormalMap
    this.shaderImpl = this.shaderImpl || SHADER_IMPLEMENT_STRATEGY.diffuseMap
  }
}

export class PbrMaterial {
  albedoMap = null
  normalMap = null // null then always face normal
  metallicMap = null
  roughnessMap = null
  ambientOcclusionMap = null

  albedoMapTexcoords = null; // auto gen
  normalMapTexcoords = null;
  metallicMapTexcoords = null
  roughnessMapTexcoords = null
  ambientOcclusionMapTexcoords = null

  shaderImpl = null;

  constructor(opts) {
    Object.assign(this, opts)
    // if no diffuseMap but color, convert color to img
    if (!this.albedoMap && opts.color) {
      this.albedoMap = makeImage(opts.color)
    }
    this.normalMap = this.normalMap || defaultNormalMap
    this.metallicMap = this.metallicMap || fillBlackMap
    this.roughnessMap = this.roughnessMap || fillBlackMap
    this.ambientOcclusionMap = this.ambientOcclusionMap || fillWhiteMap
    this.shaderImpl = this.shaderImpl || SHADER_IMPLEMENT_STRATEGY.pbr
  }
}


export class Mesh {
  position = vec3.fromValues(0, 0, 0);
  rotation = vec3.fromValues(0, 0, 0);
  scale = vec3.fromValues(1, 1, 1);
  geometry = null;
  material = null;
  name = null;
  bvhRootNode = null

  constructor(opts) {
    Object.assign(this, opts)
  }

  getTransformedGeometry() {
    // 转换为世界坐标
    return this.geometry.transform(this.rotation, this.position, this.scale)
  }

  buildBvh(meshIndex) {
    const {faces, vertices} = this.getTransformedGeometry();
    this.bvhRootNode = recursiveBuild(faces.map((face, fIdx) => {
      const [v0, v1, v2] = face.data.map(({V}) => vertices[V]);
      return {
        meshIndex,
        faceIndex: fIdx,
        bounds3: calcAABBox(v0, v1, v2)
      }
    }))
  }
}

export class Scene {
  meshes = null;
  lights = null;
  mainTexture = null;
  bvhRootNode = null
  _flattenBvhInfo = null

  constructor(meshes, lights) {
    this.meshes = meshes;
    this.lights = _.orderBy(lights, l => l instanceof DistantLight ? 0 : 1);
    meshes.forEach(m => m.geometry.triangulation())
    // init material id，假设 material 会共用
    let existedMaterials = []
    meshes.forEach(mesh => {
      if (!mesh.material || !_.isNil(mesh.material.id)) {
        return
      }
      mesh.material.id = existedMaterials.length
      existedMaterials.push(mesh.material)
    })

    // bvh
    meshes.forEach((mesh, idx) => mesh.buildBvh(idx))
    this.bvhRootNode = recursiveBuild(meshes.map((mesh, idx) => {
      return {
        meshIndex: idx,
        bounds3: mesh.bvhRootNode.bounds3,
        preFlatNode: mesh.bvhRootNode
      }
    }))
  }

  getFlattenBvhInfo() {
    // TODO 如果重新生成 BVH，则需要清楚这个缓存
    if (this._flattenBvhInfo) {
      return this._flattenBvhInfo
    }
    this._flattenBvhInfo = flattenBvhNode(this.bvhRootNode);
    return this._flattenBvhInfo
  }

  async genTexcoordsForMainTexture() {
    // 需要计算合并材质的大小，以及子材质的位置
    // 1. 取得全部材质，以及大小
    // 2. 按高度从大到小水平排布材质
    // 3. 算出最佳合并材质宽度，按行堆叠排列
    // TODO 考虑立方体每个面独立材质的情况
    // TODO 螺旋排布算法/俄罗斯方块简化排布算法
    let allSubTextures = _(this.meshes)
      .flatMap(m => {
        return Object.keys(faceVerticesPropNameDict)
          .map(texCoordPropName => {
            return (texCoordPropName in m.material) ? m.material[(texCoordPropName.replace('Texcoords', ''))] : null
          })
          .filter(_.identity)
      })
      .uniq()
      .value()
    for (let img of allSubTextures) {
      if (img.width === 0) {
        await new Promise(resolve => img.onload = resolve)
      }
    }

    let heightDescTextures = _.orderBy(allSubTextures, tex => tex.height, 'desc')
    let maxWidthOfTextures = _.max(allSubTextures.map(t => t.width))
    function arrangement(heightSortedTextures, mainTextureWidth) {
      if (_.isEmpty(heightSortedTextures)) {
        return []
      }
      let splitPos = _.findIndex(heightSortedTextures, (t, i, tArr) => {
        return mainTextureWidth < tArr.reduce((acc, curr, j) => j <= i ? acc + curr.width : acc, 0)
      })
      if (splitPos === -1) {
        return [heightSortedTextures]
      }
      let baseLayer = _.take(heightSortedTextures, splitPos)
      let remain = _.drop(heightSortedTextures, splitPos)
      return [baseLayer, ...arrangement(remain, mainTextureWidth)]
    }

    const sumWidth = _.sumBy(allSubTextures, t => t.width)
    let layerCountCases = _.range(1, Math.ceil(sumWidth / maxWidthOfTextures) + 1)
    let {arrangement: idealArrangement, mainTextureWidth, mainTextureHeight} = layerCountCases
      .map(c => {
        let layerWidth = Math.ceil(sumWidth / c)
        let finalWidth = 1 << Math.ceil(Math.log2(layerWidth))
        let arrangementCase = arrangement(heightDescTextures, finalWidth)
        let mainTextureHeight = _.sumBy(arrangementCase, layer => layer[0] ? layer[0].height : 0)
        let finalHeight = 1 << Math.ceil(Math.log2(mainTextureHeight))
        let cost = Math.abs(finalWidth - finalHeight)
        return { cost, arrangement: arrangementCase, mainTextureWidth: finalWidth, mainTextureHeight: finalHeight }
      })
      .reduce((acc, curr) => acc.cost <= curr.cost ? acc : curr)

    this.mainTexture = await mergeImgs(mainTextureWidth, mainTextureHeight, idealArrangement)

    function getPositionFromArrangement(img) {
      let j
      let i = _.findIndex(idealArrangement, layer => {
        j = _.findIndex(layer, img0 => img0 === img)
        return -1 !== j
      })
      return {
        x: idealArrangement[i].reduce((x, img0, j0) => j0 < j ? x + img0.width : x, 0),
        y: idealArrangement.reduce((y, layer, i0) => i0 < i ? y + layer[0].height : y, 0)
      }
    }

    function generateTexcoords(img, w_geometry, w_texcoords, faceVerticesPropName) {
      let {uvs} = w_geometry;
      // 取得材质位置，转换为 UV
      // 生成材质坐标
      let {x, y} = getPositionFromArrangement(img)
      let uv0 = [(x + 0.5) / mainTextureWidth, (y + 0.5) / mainTextureHeight]
      let uv1 = [(x + img.width - 0.5) / mainTextureWidth, (y + img.height - 0.5) / mainTextureHeight]

      let mToUV = mat4.fromRotationTranslationScale(
        mat4.create(),
        quat.create(),
        vec3.fromValues(uv0[0], uv0[1], 0),
        vec3.fromValues(uv1[0] - uv0[0], uv1[1] - uv0[1], 1))

      // raw uvs, [0, 1] -> [uv0, uv1]
      let uvArr = uvs.map(v2 => vec2.transformMat4(vec2.create(), v2, mToUV))
      w_texcoords.push(...uvArr)
    }

    this.meshes.forEach(m => {
      let {material, geometry} = m

      // 合并材质后，需要重新定位 UV
      Object.keys(faceVerticesPropNameDict).forEach(texCoordsPropName => {
        if (!(texCoordsPropName in material) || !_.isEmpty(material[texCoordsPropName])) {
          return
        }
        let mapPropName = texCoordsPropName.replace('Texcoords', '')
        if (!(material[mapPropName] instanceof Image)) {
          throw new Error(`Unexpected ${mapPropName} data`)
        }
        material[texCoordsPropName] = material[texCoordsPropName] || []
        generateTexcoords(material[mapPropName], geometry, material[texCoordsPropName], faceVerticesPropNameDict[texCoordsPropName])
      })

      // 根据 UV 生成切线向量，暂定每个面的切线向量都是唯一的
      let {faces, vertices} = geometry
      if (faces[0].tangent) {
        return
      }
      faces.forEach(f => {
        let v0 = vertices[f.data[0].V]
        let v1 = vertices[f.data[1].V]
        let v2 = vertices[f.data[2].V]
        let uv0 = material.normalMapTexcoords[f.data[0].T]
        let uv1 = material.normalMapTexcoords[f.data[1].T]
        let uv2 = material.normalMapTexcoords[f.data[2].T]

        f.tangent = calcTangent(v0, v1, v2, uv0, uv1, uv2)
      })
    })
  }
}

export class Ray {
  origin = null;
  direction = null; // normalized

  constructor(orig = vec3.create(), dir = vec3.fromValues(0, 0, -1)) {
    this.origin = orig;
    this.direction = dir;
  }
}
