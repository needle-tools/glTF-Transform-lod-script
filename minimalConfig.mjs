import path from "path";

import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, meshopt } from '@gltf-transform/functions';
import { ETC1S_DEFAULTS, toktx } from '@gltf-transform/cli';
import { MeshoptEncoder } from 'meshoptimizer';

function clearMaterials(options) {
    return async (document) => {
        for (const material of document.getRoot().listMaterials()) {
            material.dispose();
        }
    };
}

export default {
    extensions: [...ALL_EXTENSIONS],
    onProgramReady: ({ program, io, Session }) => {
        // for testing: two commands exposed by the same --config file
        // this one is from the sample and just clears materials
        program
            .command('clearMaterials', 'Clear Materials')
            .help('Removes all materials from the file')
            .argument('<input>', 'Path to read glTF 2.0 (.glb, .gltf) model')
            .action(({ args, options, logger }) => {
                const filename = path.basename(args.input, '.glb');
                const dir = path.dirname(args.input) + '/' + filename;
                const outputPath = dir + ".noMaterials.glb";

                Session.create(io, logger, args.input, outputPath).transform(
                    ...[
                        clearMaterials(options),
                        prune(),
                        toktx(ETC1S_DEFAULTS),
                        meshopt({encoder: MeshoptEncoder})
                    ]
                )
            });
    },
};