import {defs, tiny} from './examples/common.js';

const {
    vec3
} = tiny;

// Function to check if a point is inside a sphere (used for collision detection)
function pointInSphere(point, sphereCenter, sphereRadius) {
    const dist = Math.sqrt(
        (point[0] - sphereCenter[0]) * (point[0] - sphereCenter[0]) +
        (point[1] - sphereCenter[1]) * (point[1] - sphereCenter[1]) +
        (point[2] - sphereCenter[2]) * (point[2] - sphereCenter[2])
    );
    return dist < sphereRadius;
}

// Function to get the AABB for a cuboid
export function getAABB(scale, center) {
    return {
        min: vec3(center[0] - scale[0], center[1] - scale[1], center[2] - scale[2]),
        max: vec3(center[0] + scale[0], center[1] + scale[1], center[2] + scale[2]),
    };
}

// Function to check if AABB and sphere are colliding
// Returns 1 if the collision is with a side face, 2 if the collision is with a top/bottom face
// Returns 0 if there is no collision
export function intersectSphereAABB(AABB, sphereCenter, sphereRadius) {

    // Get the closest point to the sphere
    const closestPoint = vec3(
        Math.max(AABB.min[0], Math.min(sphereCenter[0], AABB.max[0])),
        Math.max(AABB.min[1], Math.min(sphereCenter[1], AABB.max[1])),
        Math.max(AABB.min[2], Math.min(sphereCenter[2], AABB.max[2]))
    );

    // Check if the closest point is inside the sphere
    // return pointInSphere(closestPoint, sphereCenter, sphereRadius);

    const dist = Math.sqrt(
        (closestPoint[0] - sphereCenter[0]) * (closestPoint[0] - sphereCenter[0]) +
        (closestPoint[1] - sphereCenter[1]) * (closestPoint[1] - sphereCenter[1]) +
        (closestPoint[2] - sphereCenter[2]) * (closestPoint[2] - sphereCenter[2])
    );

    if (dist < sphereRadius) {
        let deltaX = Math.abs(sphereCenter[0] - closestPoint[0]);
        let deltaY = Math.abs(sphereCenter[1] - closestPoint[1]);
        let deltaZ = Math.abs(sphereCenter[2] - closestPoint[2]);

        if (deltaY > deltaX && deltaY > deltaZ) {
            return 2;
        }
        else {
            return 1;
        }
    }
    return 0;

}

// Function to check if two spheres are colliding
export function intersectSphereSphere(sphereCenter1, sphereRadius1, sphereCenter2, sphereRadius2) {
    const dist = Math.sqrt(
        (sphereCenter1[0] - sphereCenter2[0]) * (sphereCenter1[0] - sphereCenter2[0]) +
        (sphereCenter1[1] - sphereCenter2[1]) * (sphereCenter1[1] - sphereCenter2[1]) +
        (sphereCenter1[2] - sphereCenter2[2]) * (sphereCenter1[2] - sphereCenter2[2])
    );
    return dist < sphereRadius1 + sphereRadius2;
}