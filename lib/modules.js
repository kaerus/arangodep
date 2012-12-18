var program = require('program'),
    base = require('./base'),
    fs = require('node-fs'),
    path = require('path');


var context = program.$("modules","Module deployment");

context.$(
    module_dump,"list","List modules",
    base.REMOTE_OPTION,
    {"view":{"boolean":""},"":false,"?":"View module content"},
    {"id":{"string":""},"":null,"?":"Module id"},
    {"path":{"string":""},"":null,"?":"Module path"} 
);

context.$(
    module_dump,"fetch","Download module",
    base.REMOTE_OPTION,
    {"path":{"string":""},"":null,"?":"Module path"},
    {"id":{"string":""},"":null,"?":"Module id"}
);  

context.$(
    module_dump,"remove","Delete module",
    base.REMOTE_OPTION,
    {"path":{"string":""},"":null},
    {"id":{"string":""},"":null}
);

context.$(
    module_upload,"deploy","Upload module",
    base.REMOTE_OPTION,
    {"path":{"string":""}},
    {"autoload":{"boolean":""},"":true},
    {"force":{"boolean":""},"":false}
);



function module_dump(params,dest){
    var remote = base.arangoConnection(params.remote);

    if(!params.path && !params.id) {
        params.path = "";
    } 

    if(params.id) {
        remote.document.get(params.id,function(err,ret){
            if(err) console.log("Failed to locate module with id %s:", params.id, ret);
            else if(params.$[0] === "fetch") write_module(ret,dest);
            else if(params.$[0] === "remove") remove_module(ret);
            else show_module(ret,params.view);
        });
    } else {
        remote.simple.list("_modules",{path:params.path},function(err,ret){
            if(err) console.log("Modules not found:", ret);
            else ret.result.forEach(function(module){
                if(params.$[0] === "fetch") write_module(module,dest);
                else if(params.$[0] === "remove" && params.path) remove_module(module);
                else show_module(module,params.view);         
            });
        });
    }  

    function show_module(module,view){
        var content = module.content;
        
        delete module.content;

        console.log("%j",module);

        if(view) console.log(content);
    }

    function write_module(module,dest){
        if(!dest) dest = '.';

        var destfile = dest+module.path, destdir;

        try { 
            fs.statSync(destfile); 
        } catch(e) {
            try {
                destdir = path.dirname(destfile);
                fs.statSync(destdir);
            } catch(err) { 
                fs.mkdirSync(destdir,0777, true);
                console.log("Created directory", destdir);
            }
        }

        try {
            fs.writeFileSync(destfile,module.content,'utf-8');
            console.log("Downloaded %s (%s bytes)", destfile, module.content.length);
        } catch(err){ 
            throw new Error("Failed to create file: " + err.message);
        }    
    }

    function remove_module(module){
        
        delete module.content;

        remote.document.delete(module._id,function(err,ret){
            if(err) console.log("Failed to delete module with id %s:",module._id,ret);
            else console.log("Deleted module %j",module);
        });
    }
}



function module_upload(params,source){
    var remote = base.arangoConnection(params.remote),
    ESparser = require('esprima'), syntax;

    if(typeof source !== "string") {
        console.log("Module source file is required");
        return;
    } 

    try {
        data = fs.readFileSync(source).toString();
    } catch(err) { 
        console.log("Failed to read %s: ",source,err.message);
        return; 
    }

    if(base.isBinary(data,source)) { 
        console.log("Can not deploy binary modules");
        return;
    }

    /* validate syntax to prevent serverside errors */
    try {
        syntax = ESparser.parse(data);
    } catch(e) {
        if(params.force) {
            syntax = JSON.stringify(e,null,2);
            console.log("Warning, validation errors at line", syntax);
        } else { 
            console.log("Module failed validation at line", syntax);
            return;
        }       
    }

    var _module = {path:params.path,autoload:params.autoload,content:data};

    /* check if module exists */
    remote.simple.first("_modules",{path:params.path},function(err,ret){
        if(err){
            /* create module */
            remote.document.create(true,"_modules",_module,function(err,ret){
            if(err) console.log("Failed to deploy module:", ret);
            else console.log("Deployed module %s to path %s", source, params.path); 
            });
        } else {
            /* update module */
            remote.document.put(ret.document._id,_module,function(err,ret){
                if(err) console.log("Failed to deploy module:", ret);
                else console.log("Updated module %s with path %s", source, params.path);
            });
        } 
    }); 

}