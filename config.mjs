import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { makeLods, LODExtension } from './generate_lod.mjs';
import { clearMaterials } from './clear_materials.mjs';
import { 
    stripChannelsAndMakeUnlit, 
    createDuplicateImagesAsBuffers,
    extractHighresImagesToDiskAndSavePathInExtras 
} from './strip_channels.mjs';

import { prune } from '@gltf-transform/functions';

import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ETC1S_DEFAULTS, toktx } from '@gltf-transform/cli';
import { meshopt } from '@gltf-transform/functions';

import path from "path";
import fs from "fs";

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
        
        program
            .command('fullProcess', 'Removes lighting-related vertex attributes (Normals/Tangents), compresses with etc1s + meshopt, creates deferred textures and puts low-resolution versions of those textures in the file.')
            .help('Removes all normals, tangents, normal textures, PBR textures from the file, and sets materials to unlit')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .option('--ver <suffix>', 'Version suffix (e.g. 1.2.5 → 1.2.5.2', {
                default: '',
            })
            // .argument('<output>', 'Path to write output')
            .action(({ args, options, logger }) => {
                const filename = path.basename(args.input, '.glb');
                const versionSuffix = (options.ver !== '' && options.ver !== undefined) ? '.' + options.ver : '';
                const dir = path.dirname(args.input) + '/' + filename + versionSuffix;
                
                // delete directory, then recreate it
                if (fs.existsSync(dir))
                    fs.rmdirSync(dir, { recursive: true });
                fs.mkdirSync(dir, { recursive: true });

                // root folder for export, required for some functions
                options.baseDir = dir;
                
                const outputPath = options.baseDir + "/" + filename + versionSuffix + ".glb";

                Session.create(io, logger, args.input, outputPath).transform(
                    ...[
                        stripChannelsAndMakeUnlit(options),
                        prune(),
                        createDuplicateImagesAsBuffers(options),
                        toktx(ETC1S_DEFAULTS),
                        meshopt({encoder: MeshoptEncoder}),
                        extractHighresImagesToDiskAndSavePathInExtras(options),
                    ])
                }
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