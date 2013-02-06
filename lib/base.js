
/* well used options */
exports.REMOTE_OPTION = {"remote":{"url":""},"":"http://127.0.0.1:8529","?":"ArangoDB server"};


/* extends object*/
function extend() {
  var deep = false, target, i = 0;
  if(typeof arguments[i] === "boolean") deep = arguments[i++];
  target = arguments[i++] || {};
  
  for(var source; source = arguments[i]; i++){    
    target = Object.keys(source).reduce(function(obj,key) {
      if(source.hasOwnProperty(key)) {  
        if(typeof source[key] === 'object') {
          if(deep) obj[key] = extend(true,obj[key],source[key]);
        } else if(source[key]) obj[key] = source[key];
      }    
      return obj;
    }, target);
    
  }
  
  return target;
};

exports.extend = extend;

/* returns unique array */
Array.prototype.unique = function() {
    var o = {}, i, l = this.length, r = [];

    for(i=0; i<l; i++) o[this[i]] = this[i];
    for(i in o) r.push(o[i]);

    return r;
}

/* apply replace on array */
Array.prototype.replaceString = function(r,w) {
    for(var l = this.length; l > 0; l--) {
        if(typeof this[l-1] === 'string')
            this[l-1] = this[l-1].replace(r,w);
    }  
}

Array.prototype.contains = function(s) {
    for(var l = this.length; l > 0; l--) {
        if(typeof this[l-1] === 'string'){
            if(s.indexOf(this[l-1]) >= 0) 
                return true;
        }
    } 

    return false;   
}

var path = require('path');
var well_known_ascii = ['.html','.htm','.js','.json','.java','.css','.svg','.txt','.md','.cpp','.hpp','.c','.h','.py'];
var well_known_binary = ['.jpg','.jpeg','.gif','.tiff','.png','.ico','.zip','.pdf'];

function isBinary(data,file) {

    if(file) {
        if(well_known_binary.indexOf(path.extname(file)) >= 0)
          return true;

        /* shortcut for well-known ascii files */ 
        if(well_known_ascii.indexOf(path.extname(file)) >= 0)
          return false; 
    }

    /* zero sized */
    if(!data || !data.length) 
      return false;

    /* apply heuristics */
    if(data.slice(0,data.length > 1048 ? 1048 : data.length-1).toString().indexOf('\u0000') < 0)  
        return false;
  
    return true;
}

exports.isBinary = isBinary; 

function isBase64(data){
    return (data.length % 4 == 0) && data.match("^[A-Za-z0-9+/]+[=]{0,2}$");
}

exports.isBase64 = isBase64;


function dataSize(data) {
    var len;

    if(!data || !data.length) return "empty";

    len = data.length;
    if(len > 1048576) return (len/1048576).toFixed(2) + "MB";
    if(len > 1024) return (len/1024).toFixed(2) + "KB";
    return len+"b";
}

exports.dataSize = dataSize;