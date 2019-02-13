import { Vector3, Vector2, Matrix, edgeFunction } from "./math";
import { zip, flatMap, isEmpty, round, clone, isEqual } from "lodash";
import { defaultColor, Ray } from "./engine";

let { PI, tan, floor, ceil, min, max } = Math;

export class Camera {
  width = 400;
  height = 300;
  position = Vector3.zero();
  target = Vector3.zero();
  nearClippingPlaneDistance = 0.1;
  farClippingPlaneDistance = 1000;
  _cache = {};

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

  drawPoint(backbuffer, p, r = 1, g = 1, b = 1, a = 1) {
    if (p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height) {
      let backbufferdata = backbuffer.data;
      let index = (p.x + p.y * this.width) * 4;
      backbufferdata[index] = r * 255;
      backbufferdata[index + 1] = g * 255;
      backbufferdata[index + 2] = b * 255;
      backbufferdata[index + 3] = a * 255;
    }
  }

  // https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/barycentric-coordinates
  intersectTriangle(ray, t, faceInfo, traceInfo) {
    let {
      origin: { x: oX, y: oY, z: oZ },
      direction: { x: dX, y: dY, z: dZ }
    } = ray;
    let p = new Vector3(oX + t * dX, oY + t * dY, oZ + t * dZ);
    let {
      N,
      pA,
      pB,
      pC,
      vAB,
      vBC,
      vCA,
      colorA,
      colorB,
      colorC,
      areaOfFacePara
    } = faceInfo;

    let abCap = vAB.cross(p.subtract(pA));
    if (N.dot(abCap) < 0) {
      return false;
    }
    let bcCbp = vBC.cross(p.subtract(pB));
    if (N.dot(bcCbp) < 0) {
      return false;
    }
    let caCcp = vCA.cross(p.subtract(pC));
    if (N.dot(caCcp) < 0) {
      return false;
    }

    let u = bcCbp.length() / areaOfFacePara,
      v = caCcp.length() / areaOfFacePara,
      w = abCap.length() / areaOfFacePara;
    traceInfo.u = u;
    traceInfo.v = v;
    traceInfo.w = w; // should same as 1 - u - v
    traceInfo.p = p;
    traceInfo.pR = colorA.r * u + colorB.r * v + colorC.r * w;
    traceInfo.pG = colorA.g * u + colorB.g * v + colorC.g * w;
    traceInfo.pB = colorA.b * u + colorB.b * v + colorC.b * w;
    return true;
  }

  intersect(ray, wMeshes, traceInfo) {
    for (let mI = 0; mI < wMeshes.length; mI++) {
      let faceInfos = wMeshes[mI];
      for (let i = 0; i < faceInfos.length; i++) {
        let { N, pA } = faceInfos[i];
        if (ray.direction.dot(N) > 0) {
          // isSingleSide
          continue;
        }

        let t = N.dot(pA.subtract(ray.origin)) / N.dot(ray.direction);
        if (
          1e-6 < t &&
          t < traceInfo.tNear &&
          this.intersectTriangle(ray, t, faceInfos[i], traceInfo)
        ) {
          traceInfo.tNear = t;
          traceInfo.mIdx = mI;
          traceInfo.fIdx = i;
        }
      }
    }
    return traceInfo.fIdx !== -1;
  }

  genRays(fov) {
    if (
      this._cache.raysByFov === fov &&
      isEqual(this.position, this._cache.raysByCamPos) &&
      isEqual(this.target, this._cache.raysByCanTarget)
    ) {
      return this._cache.rays;
    }
    let pixelCount = this.width * this.height;
    let halfOffset = round(tan(fov / 2), 4),
      x0 = -halfOffset,
      y0 = (halfOffset * this.height) / this.width, // x/y=w/h
      x1 = halfOffset,
      y1 = -y0,
      stepX = (x1 - x0) / this.width,
      stepY = (y1 - y0) / this.height,
      x0Center = x0 + stepX / 2,
      y0Center = y0 + stepY / 2,
      cArr = Array.from({ length: pixelCount * 4 }, (v, i) => {
        let pointIdx = i >> 2,
          xyzwIdx = i % 4;
        if (xyzwIdx === 0) {
          let colIdx = pointIdx % this.width;
          return colIdx * stepX + x0Center;
        }
        if (xyzwIdx === 1) {
          let rowIdx = floor(pointIdx / this.width);
          return rowIdx * stepY + y0Center;
        }
        return xyzwIdx === 2 ? -1 : 1;
      }),
      cMat = new Matrix(cArr, pixelCount, 4).transpose(),
      c2w = Matrix.camera2World(this.position, this.target), // 4 * 4 ;
      wMat = c2w.mul(cMat),
      wMatData = wMat.data,
      rays = Array.from({ length: pixelCount }, (v, i) => {
        let x = wMatData[i],
          y = wMatData[i + pixelCount],
          z = wMatData[i + (pixelCount << 1)];
        let dir = new Vector3(x, y, z).subtract(this.position);
        dir.normalize();
        return new Ray(this.position, dir);
      });
    this._cache.rays = rays;
    this._cache.raysByFov = fov;
    this._cache.raysByCamPos = clone(this.position);
    this._cache.raysByCanTarget = clone(this.target);
    return rays;
  }

  _traceStack = [{}, {}, {}, {}];
  _shadowRayReturnColor = {};
  castRay(ray, faceInfoByMeshes, light, returnColor, depth = 0) {
    let traceInfo = this._traceStack[depth];
    traceInfo.tNear = Infinity;
    traceInfo.mIdx = -1;
    traceInfo.fIdx = -1;
    if (this.intersect(ray, faceInfoByMeshes, traceInfo)) {
      let { N, albedoDivPI } = faceInfoByMeshes[traceInfo.mIdx][traceInfo.fIdx],
        { p } = traceInfo,
        visOfLight =
          light &&
          !this.castRay(
            new Ray(p.add(N.scale(0.001)), light.direction.scale(-1)),
            faceInfoByMeshes,
            null,
            this._shadowRayReturnColor,
            depth + 1
          ),
        cScale =
          light && visOfLight
            ? light.intensity * albedoDivPI * max(0, -N.dot(light.direction))
            : 0;
      returnColor.r = cScale === 0 ? 0 : traceInfo.pR * cScale * light.color.r;
      returnColor.g = cScale === 0 ? 0 : traceInfo.pG * cScale * light.color.g;
      returnColor.b = cScale === 0 ? 0 : traceInfo.pB * cScale * light.color.b;
      return true;
    }
    returnColor.r = 0;
    returnColor.g = 0;
    returnColor.b = 0;
    return false;
  }

  render(scene, ctx, fov = PI / 2) {
    let pixelCount = this.width * this.height;
    ctx.clearRect(0, 0, this.width, this.height);
    let backbuffer = ctx.getImageData(0, 0, this.width, this.height);
    let rays = this.genRays(fov);

    // 转换几何体坐标，计算法线
    let { meshes, lights } = scene,
      wMeshes = meshes.map((mesh, idx) => {
        let mMat = mesh.toWorldCordMatrix(),
          mMatData = mMat.data,
          wVertices = Array.from({ length: mMat.colCount }, (v, i) => {
            return new Vector3(
              mMatData[i],
              mMatData[i + mMat.colCount],
              mMatData[i + (mMat.colCount << 1)]
            );
          }),
          faceInfos = mesh.faces.map(face => {
            let { A, B, C } = face;
            let pA = wVertices[A],
              pB = wVertices[B],
              pC = wVertices[C],
              colorA = mesh.verticesColor[A],
              colorB = mesh.verticesColor[B],
              colorC = mesh.verticesColor[C],
              vAB = pB.subtract(pA),
              vBC = pC.subtract(pB),
              vCA = pA.subtract(pC),
              N = vAB.cross(pC.subtract(pA)),
              areaOfFacePara = N.length();

            N.normalize();

            return {
              N,
              pA,
              pB,
              pC,
              vAB,
              vBC,
              vCA,
              colorA,
              colorB,
              colorC,
              areaOfFacePara,
              albedoDivPI: mesh.albedo / Math.PI
            };
          });
        return faceInfos;
      });

    // 光线跟踪
    let screenPoint = {},
      resultColor = {};
    for (let i = 0; i < rays.length; i++) {
      screenPoint.x = i % this.width;
      screenPoint.y = Math.floor(i / this.width);
      for (let j = 0; j < lights.length; j++) {
        this.castRay(rays[i], wMeshes, lights[j], resultColor);

        this.drawPoint(
          backbuffer,
          screenPoint,
          resultColor.r,
          resultColor.g,
          resultColor.b,
          1
        );
      }
    }
    ctx.putImageData(backbuffer, 0, 0);
  }
}
