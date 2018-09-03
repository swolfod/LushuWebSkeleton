"use strict";

const $script = typeof document != "undefined" ? require("scriptjs") : null;
const externalScripts = require("lib/externalScripts");


function loadRemoteComponent(url, packages){
    return new Promise(function(resolve, reject) {
        $script(externalScripts.babel, () => {
            fetch(url).then(res=>res.text()).then(source=>{
                let module = {};
                let exports = {};
                function require(name){
                    return packages[name];
                }

                const transformedSource = Babel.transform(source, {
                    presets: ['react', 'es2015', 'stage-0']
                }).code;

                eval(transformedSource);

                if (module.exports)
                    resolve(module.exports);
                else
                    resolve(exports.__esModule ? exports.default : exports);
            }).catch(err => reject(err));
        });
    });
}


module.exports = {
    loadRemoteComponent
};