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

context.$(
    app_add,"add","Add source file"
);

context.$(
    app_push,"push","Push files to remote",
    {"create":true,"":false,"?":"Initialize remote"}
);

context.$(
    app_fetch,"fetch","Fetch files from remote",
    {"remote":{"url":""},"":null,"?":"Remote location"}
);

var modules = context.$(Program.$("modules"),"modules","Application modules");

modules.$(add_module,"add","Add module",
    base.REMOTE_OPTION,
    {"path":{"string":""},"":null,"?":"Module path"}
);

context.$(Program.$("routes"),"routes","Application routes");


function add_module(params,source) {
    if(!locate_index())
        return;

    app_add(params,source);
}


function app_fetch(params) {
    var remote, file, encoding, data;

    function fetch_from(url){
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
        params.remote = index.remote;
    }    

    if(!basedir) basedir = '.'+PSEP;

    remote.simple.first({index:remote.name}).then(function(res){     
        index = res;
        index.remote = params.remote;
        index.files = {};
        update_index();

        Object.keys(res.paths).forEach(function(p){
            try { 
                fs.statSync(basedir+p); 
            } catch(e) {
                fs.mkdirSync(basedir+p,res.paths[p], true);
                console.log("Created directory", basedir+p);
            }
        });

        remote.edge.list(remote_index,res._id,'out').then(function(res){
            res.edges.forEach(function(edge){
                index.files[edge.file] = {_id:edge._to,_rev:edge._rev};
                remote.document.get(edge._to).then(function(file){
                    
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



function app_push(params){
    var remote; 

    if(!index) locate_index()

    try { 
        remote = new arango.Connection(index.remote);
    } catch(err) {
        console.log("Invalid remote %s:",index.remote,err.message);
    }

    /* get remote index */
    remote.edge.list(remote.name+'_index',index._id,'out').then(function(res) {
        /* todo: compare local with remote index */
        push_to_remote(res.edges);
    },function(err) {
        if(params.create) {
            /* create remote index */
            console.log("creating index:", remote.name+'_index');
            remote.collection.create(remote.name+'_index',{type:3})
            .then(function(res){
                /* create a collection for files */
                /* maintain a copy of index file */
                console.log("creating collection:",remote.name);
                return remote.document.create(true,{index:remote.name});
            })
            .then(function(res){
                /* store index id */
                index._id = res._id;
                index._rev = res._rev;
                update_index();
                /* create index on file name */
                var skiplist = { "type" : "skiplist", "unique" : true, "fields" : [ "file" ] };                  
                return remote.index.create(remote.name,skiplist);
            })
            .then(function(res){
                /* upload files */
                push_to_remote();
            },function(err){
                console.log("Push failed with error:", err);
            });
        } else console.log("Remote index not found:", err.message);    
    });

    function push_to_remote(edges) {
        var data = {}, timeout = 10000, POLL_IV = 100,
            files = Object.keys(index.files), 
            files_to_push = files.length;          
        
        console.log("Pushing files to remote");

        files.forEach(function(file) {
            upload_file(file,function(ret) {
                index.files[file] = ret || '';
                files_to_push--;
            });
        });

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
                {   name:remote.name,
                    base:remote.path.base,
                    paths:index.paths, 
                    created: index.created, 
                    updated: now
                }
            );

            //console.log("indexed %j", indexed);
            files.forEach(function(file){

                if(!indexed || indexed.indexOf(index.files[file]._id)<0 )
                    indexFile(file);
            }); 

            function indexFile(file,create){
                return remote.edge.create(
                        remote.name+'_index',
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

        try {
            buf = fs.readFileSync(basedir+'/'+file);
        } catch(err) { 
            console.log("Failed to read %s:", file, err.message);
            return; 
        } 

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
                done({_id:ret._id,_rev:ret._rev});
            });
        } else {
            remote.document.create(data, function(err,ret) {
                if(err) console.log("Failed to upload %s:", file, ret);
                else console.log("+ %s %s (%s bytes)", bin ? "binary" : "ascii", file, data.content.length); 
                done({_id:ret._id,_rev:ret._rev});
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

function app_add(params,source){
    var stat, relpath;

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
            relpath = path.relative(basedir,path.resolve(file));

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
        }  
    } else {
        console.log("Can not handle ", source);
    }

    /* write changes to index */
    update_index(basedir); 
}

function app_init(params,appdir){
    var remote = new arango.Connection(params.remote),
        now = new Date().toISOString();

    if(!appdir) appdir = './';

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

