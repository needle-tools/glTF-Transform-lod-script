Contains two scripts built on top of gltf-transform:
- externalizing high-res textures
- generating LODs for meshes

# Texture size reduction with high-res textures in "extras"

## How to use

```js
npm install
npm run gltf-transform -- fullProcess "path/to/myFile.glb" --config config.mjs --verbose --ver 4
```

This will
- strip normals/tangents/vertex colors from the file
- create a 128x128 copy of each baseColorTexture
- make materials unlit
- compress with meshopt and etc1s
- create `myFile.etc1s+meshopt+deferred.4.glb` which has the low-resolution textures.
- move the compressed high-res textures to `myFile.etc1s+meshopt+deferred.4/<textureName>.ktx2` and reference them from each material

The parameter `--ver` is optional.  
It appends that version to both the folder and the .glb file name, such as `--ver 4`: `myFile-1.2` → `myFile-1.2.4`.

You can also choose to disable toktx/meshopt with `--noToktx` and `--noMeshopt`. The generated folders for HD textures will have matching names.

## Extras format

The extras per material look like this:

```json
"extras": {
    "deferred": {
        "baseColorTexture": {
            "uri": "hd/LargeTex3.ktx2"
        }
    }
},
```

At runtime, you can read the extras per material after loading the original file and on-demand load the high-res KTX2 textures.

---------------

# glTF-Transform-lod-script

This is a script to make LODs for an [glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) asset with [`glTF-Transform`](https://gltf-transform.donmccurdy.com/).

This script is based on [this example script](https://gist.github.com/donmccurdy/2226332bb58980caebcd21fe7cbca029).

LODs are defined with [glTF `MSFT_lod` extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/MSFT_lod/README.md).

## How to use

Use with the `--config` option of gltf-transform, see https://github.com/donmccurdy/glTF-Transform/issues/85

Requires gltf-transform 3.x.






```
$ gltf-transform lods in.glb out.glb --config generate_lods.js
```








## Options

When coverage is used, the coverage array should be one item longer than the ratio/error arrays. See MSFT_lods docs linked above for more info.  

**TODO:** haven't tested passing options into the command.

| Option | Description | Example | Required |
| ------ | ----------- | ------- | -------- |
| `--ratio ratio_values` | T.B.D. | `--ratio 0.5,0.1` | Yes |
| `--error error_values` | T.B.D. | `--error 0.01,0.05` | Yes |
| `--coverage coverage_values` | T.B.D. | `--coverage 0.7,0.3,0.0` | Yes |
| `--texture texture_values` | T.B.D. | `--texture 512x512,128x128` | Yes |
| `--interleaved` | T.B.D. | `--interleaved` | No |


## Limitations

This script is not guaranteed to work for all the possible glTF assets especially if they are complex or have extensions. Please edit the script on your end if it doesn't work for your assets.

Doesn't currently generate default coverage values if none are provided, but still injects the MSFT_screencoverage extension. This means that viewers that assume that MSFT_screencoverage entries match MSFT_lods entries may have trouble, and other viewers will come up with their own screen coverage values.
