var base = require('./base'),
    fs = require('node-fs'),
    path = require('path'),
    mime = require('mime'),
    arango = require('arango.client');
    
/* load dependencies */    
require('./modules');
require('./routes');    
  
var PSEP = process.platform === 'win32' ? '\\' : '/',
    MAX_DEPTH = 8,
    index, basedir;


var context = Program.$("app","Application deployment");

context.$(
    app_init,"init","Application init",
    {"remote":{"url":""},"?":"<http(s)://hostname:port/collection:basedir>"},
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

context.$(
    app_fetch,"fetch","Fetch files from remote",
    {"remote":{"url":""},"?":"Remote location"}
);

function app_fetch(params) {
    var remote, file, encoding, data, name;

    function fetch_from(url){
        console.log("Fetching index from:", url);
        try { 
            remote = new arango.Connection(url);
        } catch(err) {
            console.log("Index not found:",err.message);
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
    name = remote.name;

    remote.simple.first({index:name}).then(function(res){
        index = {};
        index.remote = params.remote || index.remote;
        index._id = res.document._id;
        index._rev = res.document._rev;
        index.paths = res.document.paths;
        index.files = {};
        index.created = res.document.created;
        index.updated = res.document.updated;

        if(!update_index()) return;

        Object.keys(index.paths).forEach(function(p){
            try { 
                fs.statSync(basedir+p); 
            } catch(e) {
                try {
                    fs.mkdirSync(basedir+p,index.paths[p], true);
                    console.log("Created directory", basedir+p);
                } catch(err) {
                    console.log("Failed to create directory %s:", basedir+p,err);
                }   
            }
        });

        remote.use(name+'_index').edge.list(index._id,'out').then(function(res){
            res.edges.forEach(function(edge){
                index.files[edge.file] = {_id:edge._to,_rev:edge._rev};
                remote.use(name).document.get(edge._to).then(function(file){
                    
                    if(file.headers && file.headers['content-type'] === 'base64') {
                        data = new Buffer(file.content,'base64').toString('binary');
                        encoding = 'binary';
                    } else {
                        data = file.content;
                        encoding = 'utf-8';
                    }        
                    console.log("%s %s (%s bytes)", encoding, edge.file, data ? data.length : 0);
                    try {        
                        fs.writeFileSync(basedir+edge.file,data,encoding);
                    } catch(err) { 
                        throw ("Failed to write " + encoding + " "+ edge.file + ": " + err.message); 
                    }
                },function(err){ 
                    console.log(err) 
                });  
            });
            update_index();
            },function(err){
                console.log("Failed to fetch remote index:", err);
            });

    },function(err){
        console.log("Remote index not found:", err);
    });
 
    /*
    function diff(o1,o2) {
            merge = Object.keys(o2).reduce(function(obj,key) {
                obj[key] = o2[key];    
                return obj;
            }, Object.create(o1));

            Object.keys(merge).forEach(function(key){
                if(!o1[key] || !o2[key]) {
                    console.log(o2[key] ? '+' : '-',key);
                    if(o2[key]) {
                        download_file(remote,key,basedir+key);
                        o1[key] = o2[key];
                    } else delete o1[key]; 
                } else {
                    if(o1[key]._id !== o2[key]._id) 
                        console.log("~%s _id: %s -> %s",key, o1[key]._id,o2[key]._id);
                    else if(o1[key]._rev !== o2[key]._rev) 
                        console.log("~%s _rev: %s -> %s: ",key,o1[key]._rev,o2[key]._rev);

                    download_file(remote,key,basedir+key);
                    o1[key] = o2[key];              
                }   
            });
    }
    */

}



function app_push(params,args){
    var remote, files, name; 

    if(!index) locate_index()

    try { 
        remote = new arango.Connection(index.remote);
    } catch(err) {
        console.log("Invalid remote %s:",index.remote,err.message);
    }

    name = remote.name;

    /* get remote index */
    remote.use(name+'_index').edge.list(index._id,'out').then(function(res) {
        files = res.edges;
        /* todo: compare local with remote index */
        if(args.length) {
            files = args.map(function(source){
                source = basedir + source.replace(/^\.\//,'');

            });
        }
        push_to_remote(name,res.edges);
    },function(err) {
        if(params.create) {
            /* create remote index */
            console.log("creating index:", remote.name+'_index');
            remote.collection.create(name+'_index',{type:3})
            .then(function(res){
                /* create a collection for files */
                /* maintain a copy of index file */
                console.log("creating collection:",remote.name);
                return remote.use(name).document.create(true,{index:name});
            })
            .then(function(res){
                /* store index id */
                index._id = res._id;
                index._rev = res._rev;
                update_index();
                /* create index on file name */
                var skiplist = { "type" : "skiplist", "unique" : true, "fields" : [ "file" ] };                  
                return remote.use(name).index.create(skiplist);
            })
            .then(function(res){
                /* upload files */
                push_to_remote(name);
            },function(err){
                console.log("Push failed with error:", err);
            });
        } else console.log("Remote index not found:", err.message);    
    });

    function push_to_remote(name,edges) {
        var data = {}, timeout = 10000, POLL_IV = 100,
            files = Object.keys(index.files), 
            files_to_push = files.length;          
        
        remote.use(name);
        console.log("Pushing %s files to remote", files.length);

        for(var i = files_to_push; i > 0; i--) {
            upload_file(files[i-1],function(file,ret) {
                index.files[file] = ret || '';
                files_to_push--;
            });
        }

        function until_done() {
            if(timeout < 0) {
                console.log("Operation timedout!");
                return;
            }    

            if(files_to_push > 0) 
                setTimeout(until_done,POLL_IV);
            else 
                write_remote_index();

            timeout-=POLL_IV;
        }

        function write_remote_index(){

            if(!index._id) {
                console.log("Remote index missing");
                return;
            }

            var now = new Date().toISOString(), 
                files = Object.keys(index.files),
                indexed = edges ? edges.map(function(v){
                    return v._to;
                }) : undefined;

            remote.document.put(index._id,
                {   index:name,
                    base:remote.path.base,
                    paths:index.paths, 
                    created: index.created, 
                    updated: now
                }
            );

            remote.use(name+'_index');
            files.forEach(function(file){
                if(!indexed || indexed.indexOf(index.files[file]._id)<0 )
                    indexFile(file);
            }); 

            function indexFile(file,create){
                return remote.edge.create(
                        index._id,
                        index.files[file]._id,
                        {file:file,_rev:index.files[file]._rev}
                ); 
            }

            update_index();
        }

        setTimeout(until_done,POLL_IV); 
    }

    function upload_file(file,done) {
        var buf, data = {headers:{}}, 
            bin, doc, extended = {};

        buf = fs.readFileSync(basedir+'/'+file);

        bin = base.isBinary(buf,file);

        if(bin) {
            data.headers['content-encoding'] = 'base64';
            data.content = buf.toString('base64');
        } else data.content = buf.toString();

        data.file = remote.path.base ? remote.path.base+'/'+file : file;
        data.headers['content-type'] = mime.lookup(file);
        doc = index.files[file].hasOwnProperty('_id') ? index.files[file] : null;

        if(doc !== null && doc._id){
            remote.document.putIfMatch(doc._id, doc._rev, data, function(err,ret) {
                if(err) console.log("Failed to upload %s:", file, ret);    
                else console.log("* %s %s (%s bytes)", bin ? "binary" : "ascii", file, data.content.length); 
                done(file,{_id:ret._id,_rev:ret._rev});
            });
        } else {
            remote.document.create(data, function(err,ret) {
                if(err) console.log("Failed to upload %s:", file, ret);
                else console.log("+ %s %s (%s bytes)", bin ? "binary" : "ascii", file, data.content.length); 
                done(file,{_id:ret._id,_rev:ret._rev});
            });
        }
    }
}

/* locates & reads index file within source tree */
function locate_index(){
    basedir = '.'+PSEP;
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

/* 
 * Traverses directory structure and returns filepaths to handler.  
 * Todo: handle symlinks       
 */  
function traverseFiles(dir,callback,subdir){
    var files = fs.readdirSync(dir), 
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
            traverseFiles(realpath,callback,basepath);
        else if(stat.isFile())
            callback(realpath,basepath,stat);
        else if(stat.isSymbolicLink())
            console.log("* Ignoring symlink", realpath);
        else
            console.log("* Ignoring", realpath); 
    });    
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

    /* todo: refactor */
    if(stat.isDirectory()){
        /* source is directory */  
        var subdir = path.relative(basedir,path.resolve(path.dirname(source)));

        traverseFiles(source,function(file) {
            relpath = path.relative(basedir,path.resolve(file)).toLowerCase();

            if(relpath[0]!=='.') {
                console.log("Adding",relpath);
                index.paths[path.dirname(relpath)] = index.paths[path.dirname(relpath)] || 0777;
                index.files[relpath] = index.files[relpath] || {};
            }  

        },subdir);

    } else if(stat.isFile()) {
        relpath = path.relative(basedir,path.resolve(source));

        if(relpath[0]!=='.') {
            console.log("Adding",relpath);
            index.paths[path.dirname(relpath)] = index.paths[path.dirname(relpath)] || 0777;
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
    update_index(basedir); 
}

function app_init(params,args){
    var remote = new arango.Connection(params.remote),
        now = new Date().toISOString(),
        appdir = args && args.length ? args[0] : './';

    try { 
        fs.statSync(appdir); 
    } catch(e) {
        fs.mkdirSync(appdir,0777, true);
        console.log("Created directory", appdir);
    }
       
    basedir = appdir;    
    create_index();

    function create_index() {
        index = {remote:params.remote,paths:{},files:{},created:now}
        try {
            fs.writeFileSync(basedir+PSEP+'.index', JSON.stringify(index,null,2));
            console.log("Created index for:", params.remote);
        } catch (err) {
            console.log("Failed to create index:", err.message);
            return false;
        }

        return true;
    }

    /* push index to remote */
    if(params.create) {
        app_push({create:true});
    }
    
}

