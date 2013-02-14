var base = require('./base'),
    fs = require('node-fs'),
    path = require('path'),
    arango = require('arango.client');

var context = Program.$("modules","Module deployment");

context.$(
    module_dump,"list","List modules",
    base.REMOTE_OPTION,
    {"view":true,"":null,"?":"View module content"},
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
    module_upload,"add","Upload module",
    base.REMOTE_OPTION,
    {"path":{"string":""}},
    {"autoload":{"boolean":""},"":true},
    {"force":{"boolean":""},"":false}
);

context.$(
    module_flush,"flush","Flush modules",
    base.REMOTE_OPTION
);

function module_flush(params){
    var remote = new arango.Connection(params.remote);

    remote.admin.modulesFlush().then(function(res){
        console.log(res);
    },function(err){
        console.log("Modules flush failed:",err.message);
    });
}

function module_dump(params,args){
    var remote = new arango.Connection(params.remote),
        dest = args && args.length ? args[0] : undefined;

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
        remote.use("_modules").simple.list({path:params.path},function(err,ret){
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



function module_upload(params,args){
    var remote = new arango.Connection(params.remote),
        ESparser = require('esprima'), syntax,
        source = args && args.length ? args[0] : undefined;

    if(typeof source !== "string") {
        console.log("Module source file is required");
        this.reject();
        return;
    } 

    try {
        data = fs.readFileSync(source).toString();
    } catch(err) { 
        console.log("Failed to read %s:",source,err.message);
        this.reject();
        return; 
    }

    if(base.isBinary(data,source)) { 
        console.log("Can not deploy binary modules");
        this.reject();
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
            this.reject();
            return;
        }       
    }

    var _module = {path:params.path,autoload:params.autoload,content:data};

    var modules = remote.use('_modules');

    /* check if module exists */
    modules.simple.first({path:params.path}).then(function(res) {
            /* update module */
            return modules.document.put(res.document._id,_module);
        }, function(err) {
            /* create module */
            return modules.document.create(_module);
        }).then(function(res){
            console.log("Deployed module to path %s with id", params.path, res._id);
            this.fulfill(res);
        },function(err){
            console.log("Failed to deploy module", err.message);
            this.reject(err);
        }); 

}