import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Extension, ExtensionProperty, Node, PropertyType } from '@gltf-transform/core';
import { weld, simplifyPrimitive,textureResize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

export function clearMaterials(options) {
    return async (document) => {
        for (const material of document.getRoot().listMaterials()) {
            material.dispose();
        }
    };
}