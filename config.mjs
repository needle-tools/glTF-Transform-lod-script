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
import { draco, meshopt } from '@gltf-transform/functions';

import path from "path";
import fs from "fs";

function clearAndEnsureDir(dir) {
    if (!dir) return;

    if (fs.existsSync(dir))
        fs.rmdirSync(dir, { recursive: true });

    fs.mkdirSync(dir, { recursive: true });
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
        
        program
            .command('fullProcess', 'Removes lighting-related vertex attributes (Normals/Tangents), compresses with etc1s + meshopt, creates deferred textures and puts low-resolution versions of those textures in the file.')
            .help('Removes all normals, tangents, normal textures, PBR textures from the file, and sets materials to unlit')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .option('--ver <suffix>', 'Version suffix (e.g. 1.2.5 → 1.2.5.2', {
                default: '',
            })
            .option('--noToktx', 'Skip ETC1S compression', {
                default: false,
            })
            .option('--noMeshopt', 'Skip meshopt compression', {
                default: false,
            })
            // .argument('<output>', 'Path to write output')
            .action(({ args, options, logger }) => {
                const filename = path.basename(args.input, '.glb');
                const versionSuffix = (options.ver !== '' && options.ver !== undefined) ? '.' + options.ver : '';
                let filenameWithHints = filename + versionSuffix;
                
                // ensure we can see what operations have been done on the file
                if (!options.noToktx) {
                    filenameWithHints += '.etc1s';
                }
                if (!options.noMeshopt) {
                    if (!options.noToktx)
                        filenameWithHints += '+meshopt';
                    else
                        filenameWithHints += '.meshopt';
                }
                
                // ensure we don't override the original file
                if (options.noToktx && options.noMeshopt)
                    filenameWithHints += '.deferred';
                else
                    filenameWithHints += '+deferred';

                // get directory of input file
                const inputDir = path.dirname(args.input);
                
                // root folder for export, required for some functions
                options.baseDir = inputDir;
                options.hdDir = filenameWithHints;// + "_hd";
                
                // delete directory, then recreate it
                const actualBaseDir = (options.baseDir ? options.baseDir + '/' : "");
                const hdFullDir = actualBaseDir + options.hdDir;
                // if (options.baseDir) clearAndEnsureDir(options.baseDir);
                if (options.hdDir) clearAndEnsureDir(hdFullDir);

                const outputPath = actualBaseDir + filenameWithHints + ".glb";

                const transforms = [
                    stripChannelsAndMakeUnlit(options),
                    prune(),
                    createDuplicateImagesAsBuffers(options),
                ]
                if (!options.noToktx) transforms.push(toktx(ETC1S_DEFAULTS));
                if (!options.noMeshopt) transforms.push(meshopt({encoder: MeshoptEncoder}));
                transforms.push(extractHighresImagesToDiskAndSavePathInExtras(options));

                // log full path of outputPath
                console.log("Output path: " + outputPath);
                Session.create(io, logger, args.input, outputPath).transform(...transforms);
                }
            );

        // this creates LODs for all meshes
        program
            .command('lods', 'Create LODs')
            .help('Creates LODs')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .option('--ver <suffix>', 'Version suffix (e.g. 1.2.5 → 1.2.5.2', {
                default: '',
            })
            .option('--draco', 'Use draco instead of meshopt', {
                default: false,
            })
            // .argument('<output>', 'Path to write output')
            // TODO add custom arguments to feed into madeLods
            .action(({ args, options, logger }) => {

                const filename = path.basename(args.input, '.glb');
                const versionSuffix = (options.ver !== '' && options.ver !== undefined) ? '.' + options.ver : '';
                let filenameWithHints = filename + versionSuffix;
                const encoderName = options.draco ? 'draco' : 'meshopt';
                let output = filenameWithHints + ".etc1s+" + encoderName + "+lods.glb";
                
                output = path.dirname(args.input) + "/" + output;

                const transforms = [
                    stripChannelsAndMakeUnlit(options),
                    makeLods(options),
                    prune(),
                ];

                transforms.push(toktx(ETC1S_DEFAULTS));
                if (options.draco)
                    transforms.push(draco());
                else
                    transforms.push(meshopt({encoder: MeshoptEncoder}));

                Session.create(io, logger, args.input, output).transform(...transforms)
            });
    },
};