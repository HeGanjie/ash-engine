// 参考 GAMES101_Lecture_14 page 34

// 1. Find bounding box
// 2. Recursively split set of objects in two subsets
// 3. Recompute the bounding box of the subsets
// 4. Stop when necessary
// 5. Store objects in each leaf node

import {vec3} from 'gl-matrix'
import {chunk, orderBy} from "lodash";


const fMin = -Number.MAX_VALUE
const fMax = Number.MAX_VALUE

export class Bounds3 {
  pMin = null
  pMax = null
  pCentroid = null

  constructor(p1, p2) {
    if (p1 && p2) {
      this.pMin = vec3.min(vec3.create(), p1, p2)
      this.pMax = vec3.max(vec3.create(), p1, p2)
    } else {
      this.pMin = vec3.fromValues(fMax, fMax, fMax);
      this.pMax = vec3.fromValues(fMin, fMin, fMin);
    }
  }

  unionPoint(point) {
    const ret = new Bounds3();
    ret.pMin = vec3.min(vec3.create(), this.pMin, point);
    ret.pMax = vec3.max(vec3.create(), this.pMax, point);
    return ret;
  }

  union(bounds3) {
    const ret = new Bounds3();
    ret.pMin = vec3.min(vec3.create(), this.pMin, bounds3.pMin);
    ret.pMax = vec3.max(vec3.create(), this.pMax, bounds3.pMax);
    return ret;
  }

  centroid() {
    if (this.pCentroid) {
      return this.pCentroid
    }
    const out = vec3.create();
    this.pCentroid = vec3.scaleAndAdd(out, vec3.scale(out, this.pMin, 0.5), this.pMax, 0.5)
    return out
  }

  diagonal() {
    return this.pMax - this.pMin;
  }

  maxExtent() {
    const d = this.diagonal()
    if (d[0] > d[1] && d[0] > d[2])
      return 0;
    else if (d[1] > d[2])
      return 1;
    else
      return 2;
  }
}

export const calcAABBox = (() => {
  const bb = new Bounds3()
  return (v0, v1, v2) => {
    bb.pMin = vec3.min(vec3.create(), v0, v1)
    bb.pMax = vec3.max(vec3.create(), v0, v1)
    return bb.unionPoint(v2)
  }
})();

export class BvhNode {
  bounds3 = null
  left = null
  right = null
  object = null // {meshIndex?: number, faceIndex?: number, bounds3: Bounds3}

  flat(leftNodeIdx, rightNodeIdx) {
    const {pMin, pMax} = this.bounds3
    if (this.object) {
      const {meshIndex, faceIndex} = this.object
      return {boundMin: pMin, boundMax: pMax, meshIdx: meshIndex, faceIdx: faceIndex,}
    }
    return {boundMin: pMin, boundMax: pMax, leftNodeIdx, rightNodeIdx}
  }
}

export function recursiveBuild(objects) {
  const node = new BvhNode()

  if (objects.length === 1) {
    const [obj] = objects
    node.bounds3 = obj.bounds3
    node.object = obj;
    node.left = null;
    node.right = null;
    return node;
  }

  if (objects.length === 2) {
    node.left = recursiveBuild([objects[0]])
    node.right = recursiveBuild([objects[1]])
    node.bounds3 = node.left.bounds3.union(node.right.bounds3)
    return node;
  }

  const centroidBounds = objects.reduce((acc, curr) => acc.unionPoint(curr.bounds3.centroid()), new Bounds3())

  const dim = centroidBounds.maxExtent();
  let sortedObjs = null
  switch (dim) {
    case 0:
      sortedObjs = orderBy(objects, o => o.bounds3.centroid()[0])
      break;
    case 1:
      sortedObjs = orderBy(objects, o => o.bounds3.centroid()[1])
      break;
    case 2:
      sortedObjs = orderBy(objects, o => o.bounds3.centroid()[2])
      break;
  }

  const [leftShapes, rightShapes] = chunk(sortedObjs, Math.round(objects.length / 2));

  if (leftShapes.length + rightShapes.length !== objects.length) {
    throw new Error(`Split error`)
  }

  node.left = recursiveBuild(leftShapes);
  node.right = recursiveBuild(rightShapes);

  node.bounds3 = node.left.bounds3.union(node.right.bounds3)

  return node;
}

export function recurCalcDepth(node, currDepth = 0) {
  const {left, right, object} = node
  if (object) {
    if (object.preFlatNode) {
      return recurCalcDepth(object.preFlatNode, currDepth)
    }
    return currDepth
  }
  return Math.max(recurCalcDepth(left, currDepth + 1), recurCalcDepth(right, currDepth + 1))
}

function recurFlat(node, startIdx) {
  const {left, right, object} = node
  if (object) {
    if (object.preFlatNode) {
      // mesh 的叶子节点，还需要展开三角形的根节点
      return recurFlat(object.preFlatNode, startIdx)
    }
    // 三角形的叶子节点
    return [node.flat()]
  }

  // 非叶子节点
  const leftChild = recurFlat(left, startIdx + 1);
  return [
    node.flat(startIdx + 1, startIdx + 1 + leftChild.length),
    ...leftChild,
    ...recurFlat(right, startIdx + 1 + leftChild.length)
  ]
}

// bvhNode：boundMin；boundMax；leftNodeIdx, rightNodeIdx, child meshIdx, triangleIdx；vec4 * 3 * n

// return: [{boundMin: vec3, boundMax: vec3, leftNodeIdx: number, rightNodeIdx: number, meshIdx: number, triangleIdx: number}, ...]
export function flattenBvhNode(sceneRootNode) {
  return recurFlat(sceneRootNode, 0)
}
