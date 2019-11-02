import {mat4, quat, vec2, vec3} from 'gl-matrix'
import _ from 'lodash'
import earcut from 'earcut'
import {DistantLight} from './distant-light'

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

export class Geometry {
  vertices = null
  normals = null
  faces = null

  constructor(opts) {
    Object.assign(this, opts)
  }

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

export class Material {
  diffuseMap = null // Image or TODO Image[]
  specularMap = null
  normalMap = null // null then always face normal
  albedo = 0.18;
  kD = 0.98; // phong model diffuse weight
  kS = 0.02; // phong model specular weight
  specularExp = 1;   // phong specular exponent

  diffuseMapTexcoords = null; // auto gen
  specularMapTexcoords = null;
  normalMapTexcoords = null;

  constructor(opts) {
    Object.assign(this, opts)
    // if no diffuseMap but color, convert color to img
    if (!this.diffuseMap && opts.color) {
      let canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      let ctx = canvas.getContext("2d");
      let {r, g, b, a} = opts.color
      ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a || 1})`;
      ctx.fillRect(0, 0, 1, 1);
      let dataUrl = canvas.toDataURL("image/png")
      this.diffuseMap = new Image()
      this.diffuseMap.src = dataUrl
    }
  }
}

export class Mesh {
  position = vec3.create();
  rotation = vec3.create();
  scale = vec3.fromValues(1, 1, 1);
  geometry = null;
  material = null;
  name = null;

  constructor(name, geometry, material) {
    this.name = name;
    this.geometry = geometry;
    this.material = material;
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

    this.genTexcoordsForMainTexture()
  }

  genTexcoordsForMainTexture() {
    // 需要计算合并材质的大小，以及子材质的位置
    // 1. 取得全部材质，以及大小
    // 2. 按高度从大到小水平排布材质
    // 3. 算出最佳合并材质宽度，按行堆叠排列
    // TODO 考虑立方体每个面独立材质的情况
    // TODO 螺旋排布算法/俄罗斯方块简化排布算法
    let allSubTextures = _.flatMap(this.meshes, m => {
      let {diffuseMap, specularMap, normalMap} = m.material
      return [diffuseMap, specularMap, normalMap].filter(_.identity)
    })
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

    function mergeImgs() {
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
      return canvas
    }

    this.mainTexture = mergeImgs()

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

    // function generateTexcoords(img) { }

    debugger
    this.meshes.forEach(m => {
      let {material, geometry} = m
      let {faces, vertices, normals} = geometry;
      if (!(material.diffuseMap instanceof Image)) {
        throw new Error('Unexpected diffuseMap data')
      }
      // 取得材质位置，转换为 UV
      // 生成材质坐标
      let {x, y} = getPositionFromArrangement(material.diffuseMap)
      let uv0 = [x / mainTextureWidth, y / mainTextureHeight]
      let uv1 = [(x + material.diffuseMap.width) / mainTextureWidth, (y + material.diffuseMap.height) / mainTextureHeight]

      // 生成材质坐标
      // 1. 将面旋转至 x-y 平面
      // 2. 将顶点位置映射到 x：[u0, u1] y: [v0, v1] 里面
      // 3. 设置 m.material.diffuseMapTexcoords 和 face.data[].T

      // TODO 去重
      let texcoords = m.material.diffuseMapTexcoords || []
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
          vInf.T = texcoords.length
          const uv = uvArr[vIdx]
          texcoords.push(vec2.fromValues(uv[0], uv[1]))
        })
      })
      m.material.diffuseMapTexcoords = texcoords
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
