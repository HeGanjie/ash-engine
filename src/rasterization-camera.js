import { Vector3, Vector2, Matrix, edgeFunction } from './math';
import { zip, flatMap, isEmpty } from 'lodash';
import { defaultColor } from './engine';

let { PI, tan, floor, ceil, min, max } = Math;

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
        this.zBuffer = Array.from({ length: width * height }).fill(Infinity);
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

    fillFace(backbuffer, zBuffer, face, vertices, verticesColor) {
        let { A, B, C } = face;
        let pa = vertices[A],
            pb = vertices[B],
            pc = vertices[C],
            ca = verticesColor[A] || defaultColor,
            cb = verticesColor[B] || defaultColor,
            cc = verticesColor[C] || defaultColor;
        let minX = floor(min(pa.x, pb.x, pc.x)),
            minY = floor(min(pa.y, pb.y, pc.y));
        let maxX = ceil(max(pa.x, pb.x, pc.x)),
            maxY = ceil(max(pa.y, pb.y, pc.y));

        let area = edgeFunction(pa, pb, pc);
        for (let yi = minY; yi < maxY; yi++) {
            for (let xi = minX; xi < maxX; xi++) {
                let pCheck = new Vector2(xi + 0.5, yi + 0.5);
                let w0 = edgeFunction(pb, pc, pCheck),
                    w1 = edgeFunction(pc, pa, pCheck),
                    w2 = edgeFunction(pa, pb, pCheck);
                if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                    w0 /= area;
                    w1 /= area;
                    w2 /= area;
                    let pDepth = 1 / (w0 / pa.z + w1 / pb.z + w2 / pc.z);
                    let zBufIdx = xi + yi * this.width;
                    if (zBuffer[zBufIdx] < pDepth) {
                        continue;
                    }
                    zBuffer[zBufIdx] = pDepth;
                    let w0Dz0 = w0 / pa.z,
                        w1Dz1 = w1 / pb.z,
                        w2Dz2 = w2 / pc.z;

                    let r =
                            (w0Dz0 * ca.r + w1Dz1 * cb.r + w2Dz2 * cc.r) *
                            pDepth,
                        g =
                            (w0Dz0 * ca.g + w1Dz1 * cb.g + w2Dz2 * cc.g) *
                            pDepth,
                        b =
                            (w0Dz0 * ca.b + w1Dz1 * cb.b + w2Dz2 * cc.b) *
                            pDepth;
                    pCheck.x = xi;
                    pCheck.y = yi;

                    this.drawPoint(backbuffer, pCheck, r, g, b, 1);
                }
            }
        }
    }

    render(scene, ctx, fov = PI / 2) {
        let c2w = Matrix.camera2World(this.position, this.target); // 4 * 4
        let w2c = c2w.inv();
        let worldMs = scene.meshes.map(m => m.toWorldCordMatrix()); // 4 * Vcount
        let cameraMs = worldMs.map(m => w2c.mul(m)); // 4 * Vcount
        let pp = Matrix.perspectiveProjection(
            fov,
            this.nearClippingPlaneDistance,
            this.farClippingPlaneDistance
        ); // 4 * 4
        let screen3Ds = cameraMs.map(m =>
            pp.mul(m).fromHomogeneous2CartesianCoords()
        ); // 4 * Vcount -> Vec3s

        let imageWidth = tan(fov / 2) * 2,
            imageHeight = (this.height * imageWidth) / this.width,
            imageWidthDiv2 = imageWidth / 2,
            imageHeightDiv2 = imageHeight / 2;
        let ndc3Ds = screen3Ds.map((meshScreenPointArr, mIdx) => {
            let vCountT2 = meshScreenPointArr.length * 2;
            return meshScreenPointArr.map((v3, vIdx) => {
                return new Vector3(
                    (v3.x + imageWidthDiv2) / imageWidth,
                    (v3.y + imageHeightDiv2) / imageHeight,
                    -cameraMs[mIdx].data[vIdx + vCountT2] // v3.z 是投影后的非线性的深度 (0 ~ 1)
                );
            });
        });

        ctx.clearRect(0, 0, this.width, this.height);
        let backbuffer = ctx.getImageData(0, 0, this.width, this.height);

        let zBuf = this.zBuffer.fill(Infinity);
        for (let mi = 0; mi < ndc3Ds.length; mi++) {
            let verticesPos = ndc3Ds[mi].map(v3 => {
                return new Vector3(
                    v3.x * this.width,
                    (1 - v3.y) * this.height,
                    v3.z
                );
            });
            let verticesColor = scene.meshes[mi].verticesColor;
            // raster2Ds points
            verticesPos.forEach((v3, idx) => {
                let p = new Vector2(floor(v3.x), floor(v3.y));
                let c = verticesColor[idx] || defaultColor;
                this.drawPoint(backbuffer, p, c.r, c.g, c.b, c.a);
            });
            let faces = scene.meshes[mi].faces;
            for (let face of faces) {
                this.fillFace(
                    backbuffer,
                    zBuf,
                    face,
                    verticesPos,
                    verticesColor
                );
            }
        }

        ctx.putImageData(backbuffer, 0, 0);
    }
}
