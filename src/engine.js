import {mat4, quat, vec2, vec3} from 'gl-matrix'
import _ from 'lodash'
import earcut from 'earcut'
import {DistantLight} from './distant-light'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'
import {faceVerticesPropNameDict} from './constants'

window.earcut = earcut
window.vec3 = vec3
window.mat4 = mat4


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


export class Geometry {
  vertices = null
  normals = null
  faces = null

  constructor(opts) {
    Object.assign(this, opts)
  }

  transform(rotate, move = vec3.fromValues(0, 0, 0), scale = vec3.fromValues(1, 1, 1)) {
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
      faces: _.cloneDeep(this.faces)
    })
  }

  static TrianglePlaneGeometry = new Geometry({
    vertices: [
      vec3.fromValues(-0.5, 0, 0),
      vec3.fromValues(0, 0, -0.5),
      vec3.fromValues(0.5, 0, 0),
    ],
    normals: [
      vec3.fromValues(0, 1, 0)
    ],
    faces: [
      { data:  [{V: 0, N: 0}, {V: 1, N: 0}, {V: 2, N: 0}] }
    ]
  })

  static PlaneGeometry = new Geometry({
    vertices: [
      vec3.fromValues(-0.5, 0, -0.5),
      vec3.fromValues(0.5, 0, -0.5),
      vec3.fromValues(-0.5, 0, 0.5),
      vec3.fromValues(0.5, 0, 0.5)
    ],
    normals: [
      vec3.fromValues(0, 1, 0)
    ],
    faces: [
      { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
    ]
  })

  static BoxGeometry = new Geometry({
    vertices: [
      vec3.fromValues(-0.5, 0.5, 0.5), // 左上后
      vec3.fromValues(0.5, 0.5, 0.5), // 右上后
      vec3.fromValues(-0.5, -0.5, 0.5), // 左下后
      vec3.fromValues(0.5, -0.5, 0.5), // 右下后

      vec3.fromValues(-0.5, 0.5, -0.5), // 左上前
      vec3.fromValues(0.5, 0.5, -0.5), // 右上前
      vec3.fromValues(-0.5, -0.5, -0.5), //左下前
      vec3.fromValues(0.5, -0.5, -0.5) // 右下前
    ],
    normals: [
      vec3.fromValues(0, 0, 1), // 后
      vec3.fromValues(0, 0, -1), // 前
      vec3.fromValues(1, 0, 0), // 右
      vec3.fromValues(-1, 0, 0), // 左
      vec3.fromValues(0, 1, 0), // 上
      vec3.fromValues(0, -1, 0) // 下
    ],
    faces: [
      { data:  [{V: 0, N: 0}, {V: 2, N: 0}, {V: 3, N: 0}, {V: 1, N: 0}] },
      { data:  [{V: 4, N: 1}, {V: 5, N: 1}, {V: 7, N: 1}, {V: 6, N: 1}] },
      { data:  [{V: 1, N: 2}, {V: 3, N: 2}, {V: 7, N: 2}, {V: 5, N: 2}] },
      { data:  [{V: 0, N: 3}, {V: 4, N: 3}, {V: 6, N: 3}, {V: 2, N: 3}] },
      { data:  [{V: 0, N: 4}, {V: 1, N: 4}, {V: 5, N: 4}, {V: 4, N: 4}] },
      { data:  [{V: 2, N: 5}, {V: 6, N: 5}, {V: 7, N: 5}, {V: 3, N: 5}] }
    ]
  })
}

const tempCanvas = document.createElement('canvas');
tempCanvas.width = 2;
tempCanvas.height = 2;
const tempCanvasCtx = tempCanvas.getContext("2d");

tempCanvasCtx.fillStyle = `rgba(0, 0, 0, 1)`;
tempCanvasCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
export const fillBlackMap = new Image()
fillBlackMap.src = tempCanvas.toDataURL("image/png")

tempCanvasCtx.fillStyle = `rgba(255, 255, 255, 1)`;
tempCanvasCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
export const fillWhiteMap = new Image()
fillWhiteMap.src = tempCanvas.toDataURL("image/png")

tempCanvasCtx.fillStyle = `rgba(50%, 50%, 100%, 1)`;
tempCanvasCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
const defaultNormalMap = new Image()
defaultNormalMap.src = tempCanvas.toDataURL("image/png")

export class Material {
  diffuseMap = null // Image or TODO Image[]
  specularMap = null
  normalMap = null // null then always face normal
  albedo = 0.18;
  kS = 0.02; // phong model specular weight
  specularExp = 1;   // phong specular exponent
  selfLuminous = 0;

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
      let {r, g, b, a} = opts.color
      tempCanvasCtx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a || 1})`;
      tempCanvasCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      this.albedoMap = new Image()
      this.albedoMap.src = tempCanvas.toDataURL("image/png")
    }
    this.normalMap = this.normalMap || defaultNormalMap
    this.metallicMap = this.metallicMap || fillBlackMap
    this.roughnessMap = this.roughnessMap || fillBlackMap
    this.ambientOcclusionMap = this.ambientOcclusionMap || fillWhiteMap
    this.shaderImpl = this.shaderImpl || SHADER_IMPLEMENT_STRATEGY.pbr
  }
}


export class Mesh {
  position = vec3.create();
  rotation = vec3.create();
  scale = vec3.fromValues(1, 1, 1);
  geometry = null;
  material = null;
  name = null;

  constructor(opts) {
    Object.assign(this, opts)
  }

  triangulation() {
    let {faces, vertices, normals} = this.geometry;

    faces.forEach(f => {
      // TODO 如果只有三个点则无需转换
      // do triangulation after rotate face to x-y plane
      let transformedVec3Arr = getXYPlantVerticesPosForFace(f, normals[f.data[0].N], vertices)
      let vPos = _.flatMap(transformedVec3Arr, vArr => [...vArr]);
      // [2, 3, 0, 0, 1, 2]
      f.triangleIndices = earcut(vPos, null, 3);
      if (_.isEmpty(f.triangleIndices)) {
        throw new Error('triangulation error: ' + f)
      }
      f.triangleIndicesForVertexes = f.triangleIndices.map(ti => f.data[ti].V)
    })
  }
}

export class Scene {
  meshes = null;
  lights = null;
  mainTexture = null;

  constructor(meshes, lights) {
    this.meshes = meshes;
    this.lights = _.orderBy(lights, l => l instanceof DistantLight ? 0 : 1);
    meshes.forEach(m => m.triangulation())
  }

  async genTexcoordsForMainTexture() {
    // 需要计算合并材质的大小，以及子材质的位置
    // 1. 取得全部材质，以及大小
    // 2. 按高度从大到小水平排布材质
    // 3. 算出最佳合并材质宽度，按行堆叠排列
    // TODO 考虑立方体每个面独立材质的情况
    // TODO 螺旋排布算法/俄罗斯方块简化排布算法
    let allSubTextures = _.flatMap(this.meshes, m => {
      return Object.keys(faceVerticesPropNameDict)
        .map(texCoordPropName => {
          return (texCoordPropName in m.material) ? m.material[(texCoordPropName.replace('Texcoords', ''))] : null
        })
        .filter(_.identity)
    })
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
      let {faces, vertices, normals} = w_geometry;
      // 取得材质位置，转换为 UV
      // 生成材质坐标
      let {x, y} = getPositionFromArrangement(img)
      let uv0 = [(x + 0.5) / mainTextureWidth, (y + 0.5) / mainTextureHeight]
      let uv1 = [(x + img.width - 0.5) / mainTextureWidth, (y + img.height - 0.5) / mainTextureHeight]

      // 生成材质坐标
      // 1. 将面旋转至 x-y 平面
      // 2. 将顶点位置映射到 x：[u0, u1] y: [v0, v1] 里面
      // 3. 设置 m.material.diffuseMapTexcoords 和 face.data[].T

      // TODO 去重
      faces.forEach(f => {
        // 立方体顶部和底部的材质映射可能会出问题，因为不知道哪面向上
        let transformedVec3Arr = getXYPlantVerticesPosForFace(f, normals[f.data[0].N], vertices) // vec3[]
        let xArr = transformedVec3Arr.map(v3 => v3[0])
        let yArr = transformedVec3Arr.map(v3 => v3[1])
        let minX = _.min(xArr), minY = _.min(yArr), maxX = _.max(xArr), maxY = _.max(yArr)

        // x: [0, 1], y: [0, 1]
        let mNormalize = mat4.fromRotationTranslationScale(
          mat4.create(),
          quat.create(),
          vec3.fromValues(-minX, -minY, 0),
          vec3.fromValues(1/(maxX - minX), 1/(maxY - minY), 1))
        // x：[u0, u1] y: [v0, v1]
        let mToUV = mat4.fromRotationTranslationScale(
          mat4.create(),
          quat.create(),
          vec3.fromValues(uv0[0], uv0[1], 0),
          vec3.fromValues(uv1[0] - uv0[0], uv1[1] - uv0[1], 1))
        let mTransform = mat4.mul(mat4.create(), mToUV, mNormalize)

        let uvArr = transformedVec3Arr.map(v3 => vec3.transformMat4(vec3.create(), v3, mTransform))

        f.data.forEach((vInf, vIdx) => {
          vInf[faceVerticesPropName] = w_texcoords.length
          const uv = uvArr[vIdx]
          w_texcoords.push(vec2.fromValues(uv[0], uv[1]))
        })
      })
    }

    this.meshes.forEach(m => {
      let {material, geometry} = m
      // TODO 如果是导入的模型则可以跳过生成坐标的逻辑，直接生成切线向量

      Object.keys(faceVerticesPropNameDict).forEach(texCoordsPropName => {
        if (!(texCoordsPropName in material)) {
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
      faces.forEach(f => {
        let v0 = vertices[f.data[0].V]
        let v1 = vertices[f.data[1].V]
        let v2 = vertices[f.data[2].V]
        let uv0 = material.normalMapTexcoords[f.data[0].TN]
        let uv1 = material.normalMapTexcoords[f.data[1].TN]
        let uv2 = material.normalMapTexcoords[f.data[2].TN]

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
        f.tangent = vec3.normalize(tangent, tangent)
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
