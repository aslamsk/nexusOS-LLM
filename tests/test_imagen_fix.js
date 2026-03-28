const ImageGenTool = require('../tools/imageGen');
const path = require('path');

async function test() {
    console.log("Testing Imagen Fix...");
    const savePath = path.join(__dirname, 'outputs', 'test_imagen_fix.png');
    const result = await ImageGenTool.generateImage("A cute 3D cartoon boy playing", savePath);
    console.log("Result:", result);
    if (result.includes("Success")) {
        console.log("Imagen Test PASSED!");
    } else {
        console.log("Imagen Test FAILED!");
        process.exit(1);
    }
}

test();
