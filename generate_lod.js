import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Extension, ExtensionProperty, Node, PropertyType } from '@gltf-transform/core';
import { weld, simplifyPrimitive,textureResize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

/** Custom transform example; clears materials. */
function clearMaterials(options) {
    return async (document) => {
        for (const material of document.getRoot().listMaterials()) {
            material.dispose();
        }
    };
}

/******************************************************************************
 * Example implementation of MSFT_lod for glTF-Transform.
 */

const MSFT_LOD = 'MSFT_lod';

class LODExtension extends Extension {
    extensionName = MSFT_LOD;
    static EXTENSION_NAME = MSFT_LOD;

    /** Creates a new LOD property for use on a {@link Node}. */
    createLOD(name = '') {
        return new LOD(this.document.getGraph(), name);
    }

    read() {
        throw new Error('MSFT_lod: read() not implemented');
    }

    write(context) {
        const jsonDoc = context.jsonDoc;

        for (const lod of this.properties) {
            const ids = lod.listLODs().map((node) => context.nodeIndexMap.get(node));
            const coverages = lod.listCoverages();
            lod.listParents().forEach((parent) => {
                if (parent instanceof Node) {
                    const nodeIndex = context.nodeIndexMap.get(parent);
                    const nodeDef = jsonDoc.json.nodes[nodeIndex];
                    nodeDef.extensions = nodeDef.extensions || {};
                    nodeDef.extensions[MSFT_LOD] = { ids };
                    nodeDef.extras = nodeDef.extras || {};
                    nodeDef.extras['MSFT_screencoverage'] = coverages;
                }
            });
        }

        return this;
    }
}

class LOD extends ExtensionProperty {
    static EXTENSION_NAME = MSFT_LOD;

    init() {
        this.extensionName = MSFT_LOD;
        this.propertyType = 'LOD';
        this.parentTypes = [PropertyType.NODE];
        this.coverages = [];
    }

    setCoverages(coverages) {
        this.coverages = coverages;
        return this;
    }

    getDefaults() {
        return Object.assign(super.getDefaults(), { lods: [] });
    }

    listLODs() {
        return this.listRefs('lods');
    }

    listCoverages() {
        return this.coverages;
    }

    addLOD(node) {
        return this.addRef('lods', node);
    }
}

function makeLods(options) {

    const ratios = options.ratio
        ? options.ratio.split(',').map(value => Number(value)) : [0.5, 0.25, 0.125, 0.05, 0];
    const errors = options.error
        ? options.error.split(',').map(value => Number(value)) : [0.001, 0.01, 0.01, 0.001, 0.005];
    const coverages = options.coverage
        ? options.coverage.split(',').map(value => Number(value)) : [0.5, 0.25, 0.125, 0.125 / 2, 0.125 / 4, 0];
    const textureSizes = options.texture
        ? options.texture.split(',').map(value => value.split('x').map(v => Number(v))) : [];

    return async (document) => {

        const lodExtension = document.createExtension(LODExtension);

        await MeshoptSimplifier.ready;
        const simplifier = MeshoptSimplifier;
        await document.transform(weld());

        const cloneTextureIfNeeded = (texture, resizeTextureSize, suffix) => {
            if (texture) {
                const size = texture.getSize();
                if (size[0] > resizeTextureSize[0] || size[1] > resizeTextureSize[1]) {
                    return texture.clone().setName(texture.getName() + suffix);
                }
            }
            return texture;
        };

        for (const mesh of document.getRoot().listMeshes()) {

            // Generate LOD Primitives.
            const lodMeshes = [];
            for (let i = 0; i < ratios.length; i++) {
                const ratio = ratios[i];
                const error = errors[i];
                const suffix = `_LOD${i + 1}`;
                const lodMesh = document.createMesh(mesh.getName() + suffix);
                for (const prim of mesh.listPrimitives()) {
                    const lodPrimitive = simplifyPrimitive(document, prim.clone(), { ratio: ratio, error: error, simplifier });

                    // Generate LOD textures and materials if texture resize is needed.
                    if (textureSizes.length > 0) {
                        const textureSize = textureSizes[i];
                        const material = prim.getMaterial();

                        const lodBaseColorTexture =
                            cloneTextureIfNeeded(material.getBaseColorTexture(), textureSize, suffix);
                        const lodEmissiveTexture =
                            cloneTextureIfNeeded(material.getEmissiveTexture(), textureSize, suffix);
                        const lodMetallicRoughnessTexture =
                            cloneTextureIfNeeded(material.getMetallicRoughnessTexture(), textureSize, suffix);
                        const lodNormalTexture =
                            cloneTextureIfNeeded(material.getNormalTexture(), textureSize, suffix);
                        const lodOcclusionTexture =
                            cloneTextureIfNeeded(material.getOcclusionTexture(), textureSize, suffix);

                        if (lodBaseColorTexture !== material.getBaseColorTexture() ||
                            lodEmissiveTexture !== material.getEmissiveTexture() ||
                            lodMetallicRoughnessTexture !== material.getMetallicRoughnessTexture() ||
                            lodNormalTexture !== material.getNormalTexture() ||
                            lodOcclusionTexture !== material.getOcculusionTexture()) {
                            const lodMaterial = material.clone().setName(material.getName() + suffix);
                            lodMaterial.setBaseColorTexture(lodBaseColorTexture);
                            lodMaterial.setEmissiveTexture(lodEmissiveTexture);
                            lodMaterial.setMetallicRoughnessTexture(lodMetallicRoughnessTexture);
                            lodMaterial.setNormalTexture(lodNormalTexture);
                            lodMaterial.setOcclusionTexture(lodOcclusionTexture);
                            lodPrimitive.setMaterial(lodMaterial);
                        }
                    }

                    lodMesh.addPrimitive(lodPrimitive);
                }
                lodMeshes.push(lodMesh);
            }

            // Attach LODs to all Nodes referencing this Mesh.
            const lod = lodExtension.createLOD().setCoverages(coverages);

            for (const lodMesh of lodMeshes) {
                lod.addLOD(document.createNode(lodMesh.getName()).setMesh(lodMesh));
            }

            mesh.listParents().forEach((parent) => {
                if (parent instanceof Node) {
                    parent.setExtension(MSFT_LOD, lod);
                }
            });
        }

        for (let i = 0; i < textureSizes.length; i++) {
            await document.transform(textureResize({
                size: textureSizes[i],
                pattern: new RegExp(`_LOD${i + 1}$`)
            }));
        }
    };
}

export default {
    extensions: [...ALL_EXTENSIONS, LODExtension],
    onProgramReady: ({ program, io, Session }) => {
        // for testing: two commands exposed by the same --config file
        // this one is from the sample and just clears materials
        program
            .command('clearMaterials', 'Clear Materials')
            .help('Removes all materials from the file')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .argument('<output>', 'Path to write output')
            .action(({ args, options, logger }) =>
                Session.create(io, logger, args.input, args.output).transform(clearMaterials(options))
            );
        
        // this creates LODs for all meshes
        program
            .command('lods', 'Create LODs')
            .help('Creates LODs')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .argument('<output>', 'Path to write output')
            // TODO add custom arguments to feed into madeLods
            .action(({ args, options, logger }) =>
                Session.create(io, logger, args.input, args.output).transform(makeLods(options))
            );
    },
};