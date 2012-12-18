var program = require('program'),
    base = require('./base'),
    fs = require('node-fs'),
    path = require('path'),
    mime = require('mime');
    
  
var PSEP = process.platform === 'win32' ? '\\' : '/',
    MAX_DEPTH = 8,
    index, basedir;


var context = program.$("app","Application deployment");

context.$(
    app_init,"init","Application init",
    {"remote":{"url":""},"?":"<http(s)://hostname:port/collection:basedir>"}
);

context.$(
    app_add,"add","Add files"
);

context.$(
    app_push,"push","Push files to remote",
    {"create":true,"":false,"?":"Create collection"}
);

context.$(
    app_fetch,"fetch","Fetch files from remote"
);


function app_fetch(params) {
    var remote;

    if(!locate_index()) return;

    try { 
        remote = base.arangoConnection(index.remote);
    } catch(err) {
        console.log("Invalid remote %s:",index.remote, err.message);
    }

    console.log("Fetching remote index");

    fetch_index(remote,function(remote_files) {  

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

        diff(index.files,remote_files);
        update_index();

    });

    function fetch_index(remote,callback) {
        remote.query.for('i').in(remote.name)
        .filter('i.file > "'+remote.basedir+'"')
        .return('{"file":i.file,"_id":i._id,"_rev":i._rev}')
        .exec(function(err,ret) {
            if(err) console.log("Failed to fetch index: ",ret);
            else {
                var list = {}, p = remote.basedir.length;
                ret.result.forEach(function(f) {
                    list[f.file.substring(p+1)] = {_id:f._id,_rev:f._rev};  
                });

                callback(list);
            }
        });
    }        

    function download_file(remote,file,dest){
        remote.document.get(file._id).on('result',function(ret,hdr) {
            try {
                if(base.isBinary(ret,dest)) {
                    console.log("BIN: %s (%s bytes)", dest, ret ? ret.length : 0);
                    fs.writeFileSync(dest,new Buffer(ret,'base64').toString('binary'),'binary');
                } else {
                    console.log("ASC: %s (%s bytes)", dest, ret ? ret.length : 0);
                    fs.writeFileSync(dest,ret,'utf-8');
                } 
            } catch(err) { 
                console.log("Failed to write %s:", file, err.message) 
            }
        });  
    }
}



function app_push(params){
    var remote; 

    if(!locate_index())
        return;

    try { 
        remote = base.arangoConnection(index.remote);
    } catch(err) {
        console.log("Invalid remote %s:",index.remote,err.message);
    }

    /* check for existing index */
    remote.simple.first({remote:index.remote}).then(function(res) {
        /* todo: update & merge with local index */
        push_index(basedir,{_id:res._id,_rev:res._rev,created:res.created});
    },function(err) {
        if(params.create) {
            console.log("Creating remote collection");
            remote.collection.create(function(err,ret) {
                if(err) console.log("Failed to create collection:", ret);
                else {
                    var skiplist = { "type" : "skiplist", "unique" : true, "fields" : [ "file" ] };
                    remote.index.create(skiplist,function(err,ret) {
                        if(err) console.log("Failed to create skiplist index:",ret);
                        else push_index(basedir,{create:true});
                    });
                }    
            });
        } else console.log("Failed to locate remote index at %s:", index.remote, err.message);    
    });


    function push_index(basedir,options) {
        options = options || {};
        var data = {}, timeout = 10000, POLL_IV = 100;

        if(options._id) {
            index._id = options._id;
            index._rev = options._rev;
            index.created = options.created;
        }

        if(index._id)
            remote.document.put(index._id, index, onPushIndex); 
        else
            remote.document.create(!!options.create, index, onPushIndex);

        function onPushIndex(err,ret) {
            if(err) {
                console.log("Failed to push index:",ret);
                return;
            }    

            console.log("Pushed index to remote");
            index._id = ret._id;
            index._rev = ret._rev;

            var files = Object.keys(index.files), 
                files_to_push = files.length;       

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
                    update_index();

                timeout-=POLL_IV;
            }

            setTimeout(until_done,POLL_IV); 
        }
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

        data.file = remote.basedir+'/'+file;
        data.headers['content-type'] = mime.lookup(file);
        doc = index.files[file].hasOwnProperty('_id') ? index.files[file] : null;

        if(doc !== null && doc._id){
            remote.document.putIfMatch(doc._id, doc._rev, data, function(err,ret) {
                if(err) console.log("Failed to upload %s:", file, ret);    
                else console.log("%s: %s (%s bytes)", bin ? "BIN" : "ASC", file, data.content.length); 
                done({_id:ret._id,_rev:ret._rev});
            });
        } else {
            remote.document.create(data, function(err,ret) {
                if(err) console.log("Failed to upload %s:", file, ret);
                else console.log("%s: %s (%s bytes)", bin ? "BIN" : "ASC", file, data.content.length); 
                done({_id:ret._id,_rev:ret._rev});
            });
        } 
    }
}

/* locates & reads index file within source tree */
function locate_index(){
    basedir = './';
    index = undefined;

    for(var cd = MAX_DEPTH; cd && !index; cd--) {
        try {
            index = JSON.parse(fs.readFileSync(basedir+'.index'));
        } catch (err) {
            if(basedir === './') basedir = '../';
            else basedir += '../';  
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
      console.log("Updated local index");
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
    var stat, relpath, basedir;

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
    var remote = base.arangoConnection(params.remote),
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
    
}

