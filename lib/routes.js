var base = require('./base'),
    arango = require('arango.client');

var context = Program.$("routes","Action routing");

context.$(
    route_add,"add","Add or update route",
    base.REMOTE_OPTION,
    {"url":{"string":""},"?":"Route url"},
    {"methods":{"json":""},"":null,"?":"URL methods"},
    {"constraint":{"json":""},"":null,"?":"URL constraints"},
    {"action":{"string":""},"":null,"?":"Action"},
    {"controller":{"string":""},"":null,"?":"Action controller"},
    {"prefix":{"string":""},"":null,"?":"Prefix controller"},
    {"do":{"string":""},"":null,"?":"Action do method"},
    {"options":{"json":""},"":null,"?":"Action options"},
    {"id":{"string":""},"":null,"?":"Patch route"},
    {"middleware":true,"":false,"?":"Middleware route"}
);

context.$(
    route_remove,"remove", "Delete route",
    base.REMOTE_OPTION,
    {"id":{"string":""},"?":"Route id"}
);

context.$(
    route_reload,"reload", "Reload routes",
    base.REMOTE_OPTION
);

context.$(
    route_dump,"dump", "Dumps routing table",
    base.REMOTE_OPTION
);

context.$(
    route_list,"list", "List routes",
    base.REMOTE_OPTION,
    {"id":{"string":""},"":null,"?":"Route id"},
    {"url":{"string":""},"":null,"?":"Route url"},
    {"action":{"string":""},"":null,"?":"Action (controller)"}

);


function route_add(params){
    var remote = new arango.Connection(params.remote);

    var route = {url:params.url,action:params.action||{}};       

    if(params.methods){
        route.url = {match:route.url};
        route.url.methods = params.methods;
    }

    if(params.constraint){
        if(typeof route.url === 'string')
            route.url = {match:route.url,constraint:params.constraint};
        else 
            route.url.constraint = params.constraint;
    }

    if(params.do) {
        if(typeof route.action === 'string')
            route.action = {controller:route.action,do:params.do};
        else 
            route.action.do = params.do;
    }

    if(params.controller) {
        if(typeof route.action === 'string')
            route.action = {controller:params.controller};
        else
            route.action.controller = params.controller;
    }

    if(params.prefix) {
        if(typeof route.action === 'string')
            route.action = {prefixController:params.action};
        else {
            route.action.prefixController = params.action;
            delete route.action.controller;
        }
    }

    if(params.options && route.action) {
        if(typeof route.action === 'string')
            route.action = {controller:route.action};
        route.action.options = params.options;
    }

    /* todo: handle middleware updates */

    else {
        if(params.id) remote.document.patch(params.id,params.middleware ? {middleware:[route]} : route,function(err,ret){
            if(err) console.log("Failed to update route entry:", ret);
            else console.log("Route updated:", JSON.stringify(route));
        });
        else {
            if(!route.url || !route.action) console.log("Missing route action or url");
            else remote.use("_routing").document.create(params.middleware ? {middleware:[route]} : route,function(err,ret){
                if(err) console.log("Failed to add route entry:", ret);
                else console.log("Route added:", JSON.stringify(route));  
            });
        } 
    }  
}



function route_remove(params){
    var remote = new arango.Connection(params.remote);

    remote.document.delete(params.id,function(err,ret){
        if(err) console.log("Failed to delete route:", ret);
        else console.log("Deleted route:", params.id);  
    });
}

function route_reload(params){
    var remote = new arango.Connection(params.remote);

    remote.admin.routesReload(function(err,ret){
        if(err) console.log("Failed to reload routing:",ret);
        else console.log("Routes reloaded:", ret);
    });

}


function route_dump(params){
    var remote = new arango.Connection(params.remote);

    remote.admin.routes(function(err,ret){
        if(err) console.log("Failed read routing:",ret);
        else {
            delete ret.error;
            delete ret.code;
            console.log(JSON.stringify(ret, null, 2));
        }    
    });
}

function filter_routes(routes,s_url,s_action){
    var url, action, matched, m1, m2;

    routes.forEach(function(route){            
        if(s_url) {
            url = (typeof route.url.match === 'string') ? route.url.match : route.url;   
        } 

        if(s_action) {
            action = (typeof route.action.prefixController === 'string') ? route.action.prefixController :
                        (typeof route.action.controller ==='string') ? route.action.controller : route.action;
        }

        m1 = url && url.indexOf(s_url) >= 0;
        m2 = action && action.indexOf(s_.action) >=0;

        if((url && action && m1 && m2)||(url&&!action&&m1)||(!url&&action&&m2) ) {
            if(!matched) matched = [];
            matched.push(route);
        } 
    });

    return matched;
}


function route_list(params){
     var remote = new arango.Connection(params.remote);

     if(params.id) {
        remote.document.get(options.id,function(err,route){
            if(err) console.log("Route not found: " + route);
            else console.log(route);
        });    
     } else {
        remote.use("_routing").simple.list({url:true},function(err,ret){
            var matched;

            if(err) console.log("List routings failed:", ret);
            else if (matched = filter_routes(ret.result,params.url,params.action)){
                matched.forEach(function(route){
                    console.log(JSON.stringify(route,null,2));
                });
            } else {
                console.log(JSON.stringify(ret.result,null,2));
            }    
        });
     }
}