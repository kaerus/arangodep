/* well used options */
exports.REMOTE_OPTION = {"remote":{"url":""},"":"http://127.0.0.1:8529","?":"ArangoDB server"};


/* extends object*/
exports.extend = function extend() {
    var deep = false, target = {}, i = 0;

    if(typeof arguments[i] === "boolean") deep = arguments[i++];
    if(typeof arguments[i+1] === "object") target = arguments[i++];
  
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
}


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


var path = require('path');
var well_known = ['.html','.htm','.js','.json','.java','.css','.txt','.md','.cpp','.hpp','.c','.h','.py'];

function isBinary(data,file) {

    if(file) {
        /* shortcut for well-known ascii files */ 
        if(well_known.indexOf(path.extname(file)) >= 0)
            return false; 
    }

    /* zero sized */
    if(!data || !data.length) 
        return false;

    /* apply heuristics */
    if(data.slice(0,data.length > 1024 ? 1024 : data.length-1).toString().indexOf('\u0000') < 0)  
        return false;
  
    return true;
}

exports.isBinary = isBinary; 


/* reads connection url and returns connection */
/* adds basedir to connection object */
function arangoConnection(conn_url) {
    var arango = require('arango.client');
    var x, connection = new arango.Connection(conn_url);

    /* strip out collection name */
    x = connection.name.split(':');

    if(x && x.length > 1) {
        connection.name = x[0];
        connection.basedir = x[1];
        
        if(path.extname(connection.basedir))
            connection.basedir = path.dirname(connection.basedir);
    } 

  return connection;
}

exports.arangoConnection = arangoConnection;
