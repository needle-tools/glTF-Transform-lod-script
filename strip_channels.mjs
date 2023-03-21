import { KHRMaterialsUnlit } from '@gltf-transform/extensions';

function stripMeshAttributes(document) {
    const uniqueAttributes = new Set();

    for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
            const semantics = primitive.listSemantics();
            const attributes = primitive.listAttributes();
            for (const key in attributes) {
                const attribute = attributes[key];
                const semantic = semantics[key];

                uniqueAttributes.add(semantic);

                if (semantic == 'COLOR_0') {
                    primitive.setAttribute(semantic, null);
                    attribute.dispose();
                }

                if (semantic == 'NORMAL') {
                    primitive.setAttribute(semantic, null);
                    attribute.dispose();
                }

                if (semantic == 'TANGENT') {
                    primitive.setAttribute(semantic, null);
                    attribute.dispose();
                }
            }
        }
    }

    console.log(uniqueAttributes);
}

function stripNormalMaps(document) {
    for (const material of document.getRoot().listMaterials()) {
        const normalTexture = material.getNormalTexture();
        if (normalTexture) {
            material.setNormalTexture(null);
            normalTexture.dispose();
        }
    }
}

function switchMaterialsToUnlit(document) {
    for (const material of document.getRoot().listMaterials()) {
        const unlitExt = document.createExtension(KHRMaterialsUnlit);
        const unlit = unlitExt.createUnlit();
        material.setExtension('KHR_materials_unlit', unlit);
    }
}


export function stripChannels(options) {
    return async (document) => {
        stripMeshAttributes(document);
        stripNormalMaps(document);
        switchMaterialsToUnlit(document);
/*
        const transforms = [];
        transforms.push(prune());
        transforms.push(toktx(ETC1S_DEFAULTS));
        transforms.push(meshopt({encoder: MeshoptEncoder}));
        await document.transform(...transforms);
*/
    };
}