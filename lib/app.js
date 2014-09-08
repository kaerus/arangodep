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

context.$("add","Add source file(s)",app_add)
    .$("controller","Controller module",app_add,
        {"path":{"string":""},"?":"controller path"},
        {"url":{"string":""},"?":"route url"});

context.$("rm","Remove source file(s)",app_rm)
    .$("controller","Controller module",app_rm,
        {"path":{"string":""},"?":"controller path"},
        {"url":{"string":""},"?":"route url"}); 

context.$("push","Push files to remote",app_push,
    {"create":true,"":false,"?":"Initialize remote"});

context.$("fetch","Fetch files from remote",app_fetch,
    {"remote":{"url":""},"?":"Remote location"});

context.$("reset", "reset application",app_reset,
    {"collection":true,"":false,"?":"Drop collection"});

context.$("reindex","reindex",app_reindex,
    {"remote":{"url":""},"":null,"?":"Remote location"});


function app_reindex(params){
    var remote = get_remote(params.remote);

    if(!index){
        console.log("No remote index found");
        return; 
    }
    console.log("Attempting to reindex", index.remote);

    var reindexed = [];

    Object.keys(index.files).forEach(function(file){
        reindexed.push(reindex_file(remote,file));
    });

    remote.simple.firstByExample(remote._collection,{index:remote._collection})
        .join(reindexed).then(function(finalize){
            /* update remote index */
            var now = new Date().toISOString();
            return remote.document.patch(index._id,{files:index.files,updated:now},function(){
                /* update local index */
                update_index();
                console.log("done.");
            },function(err){
                console.log("Failed to update remote index:",err);
            });
        },function(error){
            console.log("Reindex error: %j", error);
        });
}

function reindex_file(remote,file){
    return remote.simple.example(remote._collection,{file:file}).then(function(res){
        var ret;

        if(res.count == 1){
            ret = res.result[0];

            if(index.files[file]._id === ret._id && index.files[file]._rev === ret._rev) {
                console.log("%s _id ok",file);
            } else console.log("Indexed %s with _id %s _rev %s", file, ret._id, ret._rev);

            index.files[file] = {_id:ret._id,_rev:ret._rev};
        } else if(res.count > 1){
            ret = res.result[res.count-1];
            index.files[file]._id = {_id:ret._id,_rev:ret._rev};

            console.log("Indexed %s with _id %s _rev %s", file, ret._id, ret._rev);

            for(var i = 0; i < res.count-1; i++){
                remote.document.delete(res.result[i]._id).then(function(f){
                    console.log("Removed duplicate %s", f._id);
                },function(err){
                    console.log("Failed to remove %s: %j", res.result[i]._id, err);
                });
            }
        } else {
            console.log("%s not found, deleting from .index", file);

            delete index.files[file];    
        }
    });
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
        remote.simple.example({index:remote._collection}).then(function(res){
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

function get_remote(remote){

    function fetch_from(url){
        try { 
            remote = new arango.Connection(url);
        } catch(err) {
            console.log("Remote error:",err.message);
            return false;
        }

        return true;
    }

    if(remote) {  
        if(!fetch_from(remote))
            return;
    } else {
        if(!locate_index())
            return;

        if(!fetch_from(index.remote))
            return;
    }

    return remote;  
}

function app_fetch(params) {
    var remote, file, encoding, data, name;

    remote = get_remote(params.remote);
    
    if(!remote){
        console.log("Unable to locate remote index");
        return;
    }

    if(!basedir) basedir = '.'+PSEP;
    
    remote.simple.firstByExample(remote._collection,{index:remote._collection}).then(function(res){
        index = res.document;
        index.remote = params.remote;

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

        console.log("Pushing %s files to", files.length, index.remote);

        var uploads = [];

        files.forEach(function(file){
            uploads.push(upload(file));
        });

        remote.simple.firstByExample(remote._collection,{index:remote._collection})
            .join(uploads).then(finalize),function(error){
                console.log("Push failed with error:", error.message);
            };

        function finalize(result){
            var remote_index = result.shift(),
                files = {}, 
                now = new Date().toISOString();

            result.forEach(function(f){
                files[f[0]] = f[1];
            });
            console.log("Finalizing...");
            /* update remote & local index */
            return remote.document.patch(remote_index._id,{
                files: files, 
                updated: now
            }).then(update_index,function(error){
                console.log("Failed to update index", error.message);
            });
        }
    }

    function upload(file) {
        var buf, data = {headers:{}}, 
            bin, extended = {}, uploading;

        buf = fs.readFileSync(basedir+'/'+file);

        bin = base.isBinary(buf,file);

        if(bin) {
            data.headers['content-encoding'] = 'base64';
            data.content = buf.toString('base64');
        } else data.content = buf.toString();

        data.file = file;
        data.headers['content-type'] = mime.lookup(file);
       
        if(index.files[file]._id){
            uploading = remote.document.put(index.files[file]._id, data).then(function(ret){ 
                console.log("Updated(%s) ",bin ? 'binary' : 'text', file);
                return [file,{_id:ret._id,_rev:ret._rev}];   
            },function(error){
                console.log("Failed to update %s: %j", file, error);
            });
        } 
        else { 
            uploading = remote.document.create(data).then(function(ret){
             console.log("Created(%s)",bin ? 'binary' : 'text', file);
                return [file,{_id:ret._id,_rev:ret._rev}];   
            },function(error){
                console.log("Failed to create %s: %j", file, error);
            });
        }

        return uploading;
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

        traverse(source,function(file) {
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
    create_index(params.remote);

    /* push index to remote */
    if(params.create) {
        app_push({create:true});
    }
    
}

function app_rm(params,args){
    var stat, relpath,
        source = args && args.length ? args[0] : undefined;

    if(!locate_index())
        return;

    try {
        stat = fs.statSync(source);
    } catch (err) {
        console.log("Failed to locate %s:", source, err.message);
        return;
    }

    console.log("removing", source);
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


