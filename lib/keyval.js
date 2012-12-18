
/* Handles deployment to/from the arangodb key-value store */
/* TBD: need to be converted to a program module */

function process_store(argv) {
  var command = argv.shift()
    , options = {}
    , files = [];
    

  function help() {
    console.log("Key-value store deployment");
    console.log("Command:", program + ' ' + command + " <options> <sources> <destination>");
    console.log("Options:");
    console.log("-h --help".pad(16),"Shows this help"); 
    console.log("-e --expiry".pad(16),"Set Expiry date 'yyyy-mm-dd HH:MM:SS'");
    console.log("-l --list".pad(16),"List files");
    console.log("-p --path".pad(16),"Files path");
    console.log("-c --create".pad(16),"Create collection");
    console.log("-o --options".pad(16),"Collection options");
    console.log("-d --delete".pad(16),"Delete files");
    process.exit(0);
  }

  if(argv.length < 1) help();

  for(i = 0; i < argv.length; i++) {
    switch(argv[i]) {
      case '-h':
      case '--help':
        help();
        break;
      case '-e':
      case '--expiry':
        options.expiry = new Date(Date.parse(argv[++i],"yyyy-MM-dd HH:MM:SS")); 
        console.log("Expiry date: ", options.expiry.toString()); 
        break;  
      case '-l':
      case '--list':
        options.list = true;
        break;
      case '-v':
      case '--view':
        options.view = true;
        break;  
      case '-p':
      case '--path':
        options.path = argv[++i];
        break;    
      case '-d':
      case '--delete':
        options.remove = true;
        break;  
      case '-c':
      case '--create':
        options.create = true;
        break;  
      case '-o':
      case '--options':
        options.create_options = JSON.parse(argv[++i]);
        break;  
      default:
        if(argv[i].match(/^--[a-z]+$/)){
          error("Invalid option "+argv[i]);
        }
        files.push(argv[i]);
        break;
    }
  }

  processFiles(files,function(source,dest,remote,toLocal){
    var data, destdir, destfile;
    if(toLocal) {
      /* get list of files from remote */
      remote.key.list(remote.basedir,function(err,ret){
        if(err) error("Failed list files: " + ret);
        ret.forEach(function(sourcefile){
          /* destfile is same as sourcefile without remote basedir */
          destfile = dest+sourcefile.replace('%20',' ').replace(remote.basedir,'');
          try{ 
            fs.statSync(destfile); 
          } catch(e) {
            try {
              destdir = path.dirname(destfile);
              fs.statSync(destdir);
            } catch(err){ 
              fs.mkdirSync(destdir,0777, true);
              console.log("Created directory", destdir);
            }
          }
          read_remote_write_local(sourcefile,destfile,remote);
        });
      });
    } else {
      if(options.list || options.remove){
        if(!remote.basedir && !options.path) error("Option path missing");
        remote.key.list(remote.basedir,function(err,ret){
          if(err) error("Failed to list files: " + ret);
          ret.forEach(function(file){
            if(options.view){
              remote.key.get(file,function(err,ret,hdr){
                if(err) error("Failed to get remote " + file + " :" + ret);
                console.log(hdr);
                console.log(ret);
              });
            } else if(options.remove) {
              remote.key.delete(file,function(err,ret){
                if(err) error("Failed to remove " + file + " :" + ret);
                console.log("Deleted " + file);
              });
            } else console.log(ret);  
          });
        });
      } else {  
        /* add remote basedir to destfile */
        if(remote.basedir)
          destfile = remote.basedir + '/' + dest;
        else destfile = dest;

        /* uri encode spaces since arangodb can't handle that */
        destfile = destfile.replace(' ','%20');

        read_local_write_remote(source,destfile,remote,options);  
      }
    }  
  });    


  function read_remote_write_local(source,dest,remote){
    remote.key.get(source).on('result',function(ret,hdr){
      try {
        if(isBinary(ret,dest)){
          console.log("BIN: %s (%s bytes)", dest, ret ? ret.length : 0);
          fs.writeFileSync(dest,new Buffer(ret,'base64').toString('binary'),'binary');
        } else {
          console.log("ASC: %s (%s bytes)", dest, ret ? ret.length : 0);
          fs.writeFileSync(dest,ret,'utf-8');
        } 
      } catch(err) { error("Failed to write file:", err.message) }
    });  
  }

  function read_local_write_remote(source,dest,remote,options) {
    var data, bin, extended = {}, options = {};
    
    if(options.create) {
      console.log("Creating collection ", remote.config.name);
      remote.collection.create().on('error', function(err){
        error("Collection create failed: " + err.message);
      }).on('result',store);
    } else store();    

    function store() {
      try {
        data = fs.readFileSync(source);
      } catch(err) { error("Failed to read file:", err.message) } 

      bin = isBinary(data,source);
      extended.contentType = mime.lookup(source);
      if(bin) extended["contentEncoding"] = "base64";
      if(typeof options.expiry === 'object') options.expires = options.expiry;
      options.extended = extended;
      remote.key.put(dest, options, 
            bin ? data.toString('base64') : data, function(err,ret) {
              if(err) error("Failed to deploy " + source + ": " + ret);
              else console.log("%s: %s (%s bytes)", bin ? "BIN" : "ASC", source, data.length);  
      });
    }  
  }
} /* end of process_store */