var base = require('./base'),
    fs = require('node-fs'),
    path = require('path'),
    mime = require('mime'),
    arango = require('arango');
    
/* load dependencies */    
require('./modules');
require('./routes');    

var PSEP = process.platform === 'win32' ? '\\' : '/',
    MAX_DEPTH = 8,
    basedir, 
    index;

var context = Program.$("app","Application deployment");

context.$(
    app_init,"init","Application init",
    {"remote":{"url":""},"?":"<http(s)://hostname:port/database:collection#basedir>"},
    {"create":true,"":false,"?":"Initialize remote"}
);

context.$(app_add,"add","Add source file")
    .$(app_add,"controller","Controller module",
            {"path":{"string":""},"?":"controller path"},
            {"url":{"string":""},"?":"route url"}
);

context.$(
    app_push,"push","Push files to remote",
    {"create":true,"":false,"?":"Initialize remote"}
);

context.$(app_fetch,"fetch","Fetch files from remote",
    {"remote":{"url":""},"?":"Remote location"}
);

context.$(app_reset,"reset", "reset application",
    {"collection":true,"":false,"?":"Drop collection"}
);

context.$(app_reindex,"reindex","reindex");


var modules = context.$("modules","Application modules");

modules.$(add_module,"add","Add module",Program.modules.add['&']);

function add_module(params,args){
    console.log("testing");
    Program.modules.add(params,args).then(function(res){
        console.log("adding application module", res);
    },function(err){
        console.log("faild to add application module", err);
    });
}

function app_reindex(params){
    if(!index) locate_index();

    console.log("Attempting to repair index for %s", file);
    remote.simple.example({file:file}).then(function(res){
        if(res.count == 1){
            console.log("Reindexing %s with _id", file, res.result[0]._id);

            index.files[file]._id = res.result[0]._id;
        } else if(res.count > 1){
            console.log("Filename clashes, keeping last and removing duplicates");

            index.files[file]._id = res.result[res.count-1]._id;

            for(var i = 0; i < res.count-1; i++){
                remote.document.delete(res.result[i]._id).then(function(f){
                    console.log("Removed %s", f._id);
                },function(err){
                    console.log("Failed to remove %s: %j", res.result[i]._id, err);
                });
            }
        } else {
            console.log("No such file: %s, deleting from .index");

            delete index.files[file];    
        }
        /* update remote index */
        var now = new Date().toISOString();
        remote.document.patch(index._id,{files:index.files,updated:now},function(){
            /* update local index */
            update_index();
        },function(err){
            console.log("Failed to update remote index:",err);
        });

        fetch_file(remote,file);
    },function(err){
        console.log("Failed with search query: %j",err);
    })
}

function app_reset(params){
    var remote;

    if(!index) locate_index()

    console.log("Flushing content from", index.remote);
    remote = new arango.Connection(index.remote);

    if(params.collection) {
        remote.collection.delete(remote._collection).then(function(){
            console.log("Deleted collection");
        },function(err){
            console.log("Failed to delete collection:", err);
        });
    } else {
        Object.keys(index.files).forEach(function(file){
            remote.simple.example({file:file}).then(function(res){
                res.result.forEach(function(doc){
                    remote.document.delete(doc._id).then(function(){
                        console.log("deleted", doc.file);
                    },function(err){
                        console.log("failed to delete %s:", doc.file, err.message);
                    });
                });
            },function(err){
                console.log("%s not found:", file, err.message);
            });
        });

        console.log("Flushing remote index");
        remote.simple.example({index:base.remote._collection}).then(function(res){
            res.result.forEach(function(doc){
                remote.document.delete(doc._id).then(function(){  
                    console.log("deleted index:", doc.index);
                },function(err){
                    console.log("failed to remove index %s:", doc.index,err);
                });
            });    
        });
    }    

    console.log("Flushing local index");
    Object.keys(index.files).forEach(function(file){
        index.files[file] = {};
    });

    delete index._id;
    delete index._rev;
    delete index.created;
    delete index.updated;
    update_index();
}

function app_fetch(params) {
    var remote, file, encoding, data, name;

    function fetch_from(url){
        try { 
            remote = new arango.Connection(url);
        } catch(err) {
            console.log("Remote error:",err.message);
            return false;
        }

        return true;
    }


    if(params.remote) {  
        if(!fetch_from(params.remote))
            return;
    }    
    else {
        if(!locate_index())
            return;

        if(!fetch_from(index.remote))
            return;
    }    

    if(!basedir) basedir = '.'+PSEP;
    
    remote.simple.first({index:remote._collection}).then(function(res){
        index = res.document;
        base.remote = params.remote;

        try {
            if(!update_index()){
                console.log("Failed to create local index");
                return;  
            }
        } catch(err) {
            console.log("Failed to update index: ", err.message);
            return;
        } 

        if(!index.files) {
            console.log("No files to fetch!");
            return;
        }
        
        var num_files = Object.keys(index.files).length;

        console.log("Fetching %s files", num_files);

        Object.keys(index.files).forEach(function(file){
            if(!index.files[file]._id){
                console.log("Mising _id on %s, use 'app reindex' to repair", file);
            } else fetch_file(remote,file).done(update_index);
        });

    },function(err){
        console.log("Failed to locate remote index:", err.message);
    });
 
}

function fetch_file(remote,file){
    var dirname;

    return remote.document.get(index.files[file]._id).then(function(doc){ 
        dirname = path.dirname(basedir+doc.file); 
        try { 
            fs.statSync(dirname); 
        } catch(e) {
            try {
                fs.mkdirSync(dirname,0777,true);
                console.log("Created directory", dirname);
            } catch(err) {
                console.log("Failed to create directory %s:", dirname,err);
            }   
        }

        if(doc.headers && doc.headers['content-encoding'] === 'base64') {
            data = new Buffer(doc.content,'base64').toString('binary');
            encoding = 'binary';
        } else {
            data = doc.content;
            encoding = 'utf-8';
        }        
        console.log("%s %s(%s)", doc.file, encoding, base.dataSize(data));
        try {        
            fs.writeFileSync(basedir+doc.file,data,encoding);
        } catch(err) { 
            throw ("Failed to write " + encoding + " "+ doc.file + ": " + err.message); 
        }
    },function(err){ 
        console.log("Failed to fetch %s with _id(%s):", file, index.files[file]._id, err);
    }); 
}


function app_push(params,args){
    var remote, files , p; 

    if(!index) locate_index()

    try { 
        remote = new arango.Connection(index.remote);
    } catch(err) {
        console.log("Invalid remote %s:",index.remote,err.message);
    }

    /* normalize paths */
    args = args.map(function(f){
        p = path.resolve(f);
        return p.indexOf(basedir) === 0 ? p.substr(basedir.length+1,p.length) : null;
    });
 
    /* get remote index */
    remote.document.get(index._id).then(function(res) {
        push_to_remote();
    },function(err) {
        if(params.create) {
            /* create remote index */
            console.log("creating index:", remote._collection);
            remote.document.create({index:remote._collection},{createCollection:true})
            .then(function(res){
                /* store index id */
                index._id = res._id;
                index._rev = res._rev;
                update_index();
                /* create contraints on index and file */
                var skiplist = { "type" : "skiplist", "unique" : true, "fields" : [ "index", "file" ] };                  
                return remote.index.create(skiplist);
            })
            .then(function(res){
                /* upload files */
                push_to_remote();
            },function(err){
                console.log("Error on push:", err.message);
            });
        } else console.log("Remote index not found");    
    });

    function push_to_remote() {
        
        if(!index._id) {
            console.log("Remote index _id missing, aborting push");
            return;
        }

        var data = {}, f;
        
        var files = Object.keys(index.files);

        if(args && args.length) {
            files = files.filter(function(f){
                return args.contains(f);
            });
        }     

        var files_to_push = files.length;

        console.log("Pushing %s files to", files.length, index.remote);

        for(var i = files_to_push; i > 0; i--) {
            upload_file(files[i-1],function(file,ret) {
                index.files[file] = ret || ''; 
                files_to_push--;
            });
        }

        function until_done() {
            if(files_to_push > 0) 
                setTimeout(until_done,250);
            else finalize_push();
        }

        setTimeout(until_done,250); 
 
        function finalize_push(){
            var now = new Date().toISOString();

            /* update remote index */
            remote.document.patch(index._id,{
                files: index.files, 
                updated: now
            },function(){
                console.log("Updated remote index");
            },function(err){
                console.log("locate_index remote index:",err);
            });

            /* update local index */
            update_index();
        }

    }

    function upload_file(file,done) {
        var buf, data = {headers:{}}, 
            bin, extended = {};

        buf = fs.readFileSync(basedir+'/'+file);

        bin = base.isBinary(buf,file);

        if(bin) {
            data.headers['content-encoding'] = 'base64';
            data.content = buf.toString('base64');
        } else data.content = buf.toString();

        data.file = file;
        data.headers['content-type'] = mime.lookup(file);
       
        if(index.files[file]._id){
            remote.document.put(index.files[file]._id, data).then(function(ret){ 
                console.log("U",file);
                done(file,{_id:ret._id,_rev:ret._rev});   
            },function(err) {
                console.log("%s:", file, err.message);
            });
        } else {
            remote.document.create(data).then(function(ret){
                console.log("C",file);
                done(file,{_id:ret._id,_rev:ret._rev});   
            },function(err){
                console.log("%s:", file, err.message);
            });
        }
    }
}



function app_add(params,args){
    var stat, relpath,
        source = args && args.length ? args[0] : undefined;

    if(!locate_index())
        return;

    try {
        stat = fs.statSync(source);
    } catch (err) {
        console.log("Failed to read %s:", source, err.message);
        return;
    }

    if(stat.isDirectory()){
        /* source is directory */  
        var subdir = path.relative(basedir,path.resolve(path.dirname(source)));

        base.traverse(source,function(file) {
            relpath = path.relative(basedir,path.resolve(file)).toLowerCase();

            if(relpath[0]!=='.') {
                console.log("Adding",relpath);
                index.files[relpath] = index.files[relpath] || {};
            }  

        },subdir);

    } else if(stat.isFile()) {
        relpath = path.relative(basedir,path.resolve(source));

        if(relpath[0]!=='.') {
            console.log("Adding",relpath);
            index.files[relpath] = index.files[relpath] || {};
            if(params.$[0] === 'controller') {
                console.log("Adding controller for url %s -> path %s", params.url, params.path);
                var controller = index.files[relpath].controller || {};   
                controller.module = params.path;
                controller.route = params.url;
                index.files[relpath].controller = controller;
            }
        }  
    } else {
        console.log("Can not handle ", source);
    }

    /* write changes to index */
    update_index(); 
}

function app_init(params,args){
    var remote = new arango.Connection(params.remote),
        appdir = args && args.length ? args[0] : '.' + PSEP;

    try { 
        fs.statSync(appdir); 
    } catch(e) {
        fs.mkdirSync(appdir,0777, true);
        console.log("Created directory", appdir);
    }
       
    basedir = appdir;    
    base.create_index(remote);

    /* push index to remote */
    if(params.create) {
        app_push({create:true});
    }
    
}



/* locates & reads index file within source tree */
function locate_index(){
    basedir = '.' + PSEP;

    index = undefined;

    for(var cd = MAX_DEPTH; cd && !index; cd--) {
        try {
            index = JSON.parse(fs.readFileSync(basedir+'.index'));
        } catch (err) {
            if(basedir === '.'+PSEP) basedir = '..'+PSEP;
            else basedir += '..'+PSEP;  
        }
    } 
  
    if(!index) {
        console.log("Index not found");
        basedir = null;
        return false;
    }    

    basedir = path.resolve(basedir); 

    return true;
}


/* write local index */
function update_index(){
    var now = new Date().toISOString();

    index.updated = now;

    try {     
        fs.writeFileSync(basedir+PSEP+'.index', JSON.stringify(index, null, 2));
    } catch (err) {
        console.log("Failed to update local index:",err.message);
        return false;
    }

    return true;
}

/* initialize local index */
function create_index(remote) {
    var now = new Date().toISOString();

    index = {remote:remote,files:{},modules:{},routes:{},created:now}

    try {
        fs.writeFileSync(basedir+PSEP+'.index', JSON.stringify(index,null,2));
        console.log("Created index:", remote);
    } catch (err) {
        console.log("Failed to create index:", err.message);
        return false;
    }

    return true;
}


/* 
 * Traverses directory structure and returns filepaths to handler.        
 */  
function traverse(dir,callback,subdir){
    var stat, files = fs.readdirSync(dir), 
        extname, realpath, basepath;    
  
    files.forEach(function(file) {
        realpath = dir+PSEP+file;
        basepath = subdir ? subdir+PSEP+file : file;
    
        try {
            stat = fs.statSync(realpath);
        } catch(err) { 
            console.log("Failed to read %s:", realpath, err.message );
            return; 
        }  

        /* traverse subdirs */
        if(stat.isDirectory()) 
            traverse(realpath,callback,basepath);
        else if(stat.isFile())
            callback(realpath,basepath,stat);
        else console.log("* Ignoring", realpath); 
    });    
}


