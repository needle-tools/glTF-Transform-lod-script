import fs from "fs";
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import sharp from "sharp";

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

                if (
                    semantic == 'COLOR_0' || semantic == 'COLOR_1' || 
                    semantic == 'NORMAL' || semantic == 'TANGENT') {
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

const LOW_RES = "__lowres";

export function createDuplicateImagesAsBuffers(options) {
    return async (document) => {
        // iterate all materials and duplicate the baseColorTexture to the emissiveTexture slot, but as buffer
        for (const material of document.getRoot().listMaterials()) {
            const baseColorTexture = material.getBaseColorTexture();
            if (baseColorTexture) {
                const name = baseColorTexture.getName();
                const image = baseColorTexture.getImage();

                // resize with Sharp
                const newBuffer = await sharp(image)
                    .resize(128, 128)
                    .png()
                    .toBuffer();

                const newTexture = document.createTexture(name + LOW_RES);
                newTexture.setImage(newBuffer);
                newTexture.setMimeType("image/png");
                material.setEmissiveTexture(newTexture);
            }
        }
    };
}

export function extractHighresImagesToDiskAndSavePathInExtras(options) {
    return async (document) => {
        // iterate all materials and duplicate the baseColorTexture to the emissiveTexture slot, but as buffer
        for (const material of document.getRoot().listMaterials()) {
            const baseColorTexture = material.getBaseColorTexture();
            const emissiveTexture = material.getEmissiveTexture();

            if (baseColorTexture && emissiveTexture && emissiveTexture.getName().endsWith(LOW_RES)) {
                
                const name = baseColorTexture.getName();
                const mime = baseColorTexture.getMimeType();
                const extension = mime.split("/")[1];
                const data = baseColorTexture.getImage();

                const hdDir = "hd";
                const fullDir = options.baseDir + "/" + hdDir;
                // create directory if it doesn't exist
                fs.mkdirSync(fullDir, { recursive: true });

                // write "image" buffer to disk
                const uri = fullDir + "/" + name + "." + extension;
                fs.writeFileSync(uri, data);

                material.setExtras({
                    deferred: {
                        baseColorTexture: {
                            uri: hdDir + "/" + name + "." + extension,
                        }
                    }
                });

                // shuffle around so that our lowres texture is the baseColorTexture
                // and highres is removed from the document - it's now external
                material.setBaseColorTexture(emissiveTexture);
                material.setEmissiveTexture(null);
                baseColorTexture.dispose();
            }
        }
    }
}

export function stripChannelsAndMakeUnlit(options) {
    return async (document) => {
        stripMeshAttributes(document);
        stripNormalMaps(document);
        switchMaterialsToUnlit(document);
    };
}