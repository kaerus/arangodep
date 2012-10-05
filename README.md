arangodep
=========

Arango deployment tools.

Install
-------
```
sudo npm install https://github.com/kaerus/arangodep -g
```
...and don't forget to update with ```npm update```.

Usage
-----
Execute ```arangodep``` to see command options.
```
$ arangodep
Arango deployment tools v0.3.2 by Anders Elo <anders @ kaerus com>.
Commands:
           store: deploy files as key-values
          module: deploy files as modules
           dummy: dummy process
type: 'arangodep <command> --help' for more information.
```

Warning: this tool can ruin you database, use with caution! 


Examples
========

arangodep route
---------------
You can manage ArangoDBs action routing with this command.
```
$ arangodep route
Deploy action routing
Command: arangodep route <options> <server>
Options:
-h --help        Shows this help
-u --url         Url to match
-a --action      Action controller
-c --constraint  Url constraints
-l --list        List routes
-v --view        View route
-i --id          Route id
-d --delete      Delete route
-r --reload      Reloads routing table
```

To view a selection of routes specify the url by using the ```-u``` option and include ```-v``` for viewing.
The last option is the url to the server, if omitted it defaults to ```http://127.0.0.1:8529```.
```
$ arangodep route -u /org/arangodb -v http://127.0.0.1:8529
[ 
  { _id: '27804071/858341799',
    _rev: 858341799,
    url: 'com/kaerus/modules',
    action: '/org.arangodb/actions/routes' },
  { _id: '27804071/29639079',
    _rev: 30622119,
    url: { match: '/hello/world' },
    action: { controller: 'org/arangodb/actions/hello' } },
  { _id: '27804071/855327143',
    _rev: 855327143,
    action: 'org/kaerus/modules/routing',
    url: { constraint: 'nada', match: '/test/dummy' } },
  { _id: '27804071/30818727',
    _rev: 30818727,
    url: { match: '/routes' },
    action: { controller: 'org/arangodb/actions/routes' } },
  { _id: '27804071/932135335',
    _rev: 932135335,
    url: 'routing/reload',
    action: 'org/arangodb/modules/actions/route_reloader' } ]
```
To delete a route you can specify the route with ```--id <id>``` and ```--delete```.
```
$ arangodep route --id 27804071/855327143 --delete
Route deleted:  { action: 'org/kaerus/modules/routing',
  url: { constraint: 'nada', match: '/test/dummy' },
  _id: '27804071/855327143',
  _rev: 855327143 }
```
To get a list of all routes in a compact format use ```--view```without the url option.
```
$ arangodep route --view
[ { _id: '27804071/858341799',
    _rev: 858341799,
    url: 'com/kaerus/modules',
    action: '/org.arangodb/actions/routes' },
  { _id: '27804071/29639079',
    _rev: 30622119,
    url: { match: '/hello/world' },
    action: { controller: 'org/arangodb/actions/hello' } },
  { _id: '27804071/30818727',
    _rev: 30818727,
    url: { match: '/routes' },
    action: { controller: 'org/arangodb/actions/routes' } },
  { _id: '27804071/932135335',
    _rev: 932135335,
    url: 'routing/reload',
    action: 'org/arangodb/modules/actions/route_reloader' } ]

```
To get a detailed list of the routing table use ```--list```.

To add a route you only need to specify the action (controller) and the url (location).
```
$ arangodep route --action com/kaerus/modules/mymodule --url api/myapi/mymodule 
Route added:  { url: 'api/myapi/mymodule',
  action: 'com/kaerus/modules/mymodule' }
```
The url can include a constraint, specified with the ```--contraint```option.
The action can include a (non conventional) method specified with the ```--do```option.

arangodep module
----------------
Used for deploying or viewing installed modules.
```
$ arangodep module
Module deployment
Command: arangodep module <options> <sources> <destination>
Options:
-h --help        Shows this help
-p --path        Module path
-i --id          Module id
-l --list        List modules
-v --view        View module
-s --search      Search modules
-d --delete      Delete module
```
List the installed modules with the ```--list```option
```
$ arangodep module --list
{"_id":"32326055/932069799","_rev":932069799,"path":"org/arangodb/modules/actions/route_reloader"}
{"_id":"32326055/854409639","_rev":854409639,"path":"org/arangodb/modules/echoController.js"}
```
To view a module, specify the module id with ```-i```and add the ```-v```option
```
$ arangodep module -i 32326055/932069799 -v 
{"path":"org/arangodb/modules/actions/route_reloader","_id":"32326055/932069799","_rev":932069799}
exports.get = function(req,res){require("internal").reloadRouting();res.responseCode=200;};
```

You can search for modules by path.
```
$ arangodep module --search --path route
{"_id":"32326055/932069799","_rev":932069799,"path":"org/arangodb/modules/actions/route_reloader"}
```
Delete module by id.
```
$ bin/arangodep module -d -i 32326055/932069799
Deleted module 32326055/932069799
```

arangodep store
---------------
With this command you may deploy files to the ArangoDB key-value index.

```
$ arangodep store
Key-value store deployment
Command: arangodep store <options> <sources> <destination>
Options:
-h --help        Shows this help
-p --path        Files path
-e --expiry      Set Expiry date 'yyyy-mm-dd HH:MM:SS'
-l --list        List files
-d --delete      Delete files
```

For file deployment you need to specify the server with collection name and basedir separated by a ```:```.
```
$ arangodep store ./ http://127.0.0.1:8529/admin:test -e 2012-10-05
Epiry date:  Fri Oct 05 2012 02:00:00 GMT+0200 (CEST)
Deployed test/.git/description (5944 bytes)
Deployed test/.git/HEAD (5944 bytes)
Deployed test/.git/COMMIT_EDITMSG (5944 bytes)
Deployed test/.git/hooks/applypatch-msg.sample (5944 bytes)
Deployed test/.git/config (5944 bytes)
Deployed test/.git/hooks/commit-msg.sample (5944 bytes)
Deployed test/.git/hooks/post-update.sample (5944 bytes)
Deployed test/.git/hooks/pre-applypatch.sample (5944 bytes)
Deployed test/.git/hooks/update.sample (5944 bytes)
Deployed test/.git/index (5944 bytes)
Deployed test/.git/hooks/prepare-commit-msg.sample (5944 bytes)
Deployed test/.git/hooks/pre-rebase.sample (5944 bytes)
Deployed test/.git/hooks/pre-commit.sample (5944 bytes)
Deployed test/.git/info/exclude (5944 bytes)
Deployed test/.git/logs/refs/remotes/origin/HEAD (5944 bytes)
Deployed test/.git/logs/refs/heads/master (5944 bytes)
Deployed test/.git/logs/refs/remotes/github/master (5944 bytes)
...
```
Note: deployed content has an expiration date after when it gets removed automatically.

To download files you specify the remote as source and a local directory as destination.
```
$ arangodep store http://127.0.0.1:8529/admin:test ./test
Created directory ./test/.git/objects/be
Created directory ./test/.git/objects/54
Created directory ./test/.git/objects/ad
Created directory ./test/.git/objects/pack
Created directory ./test/.git/objects/b6
Created directory ./test/.git/refs/remotes/origin
Created directory ./test/.git/objects/2a
Created directory ./test/.git/hooks
Created directory ./test/.git/objects/e9
Created directory ./test/.git/objects/39
Created directory ./test/.git/objects/9c
Created directory ./test/.git/objects/3d
Created directory ./test/.git/objects/76
Created directory ./test/.git/objects/9f
Created directory ./test/.git/objects/15
...
```

To delete files you use the ```-d```option and specify the collection and basedir.
```
$ arangodep store -d http://127.0.0.1:8529/admin:test
Deleted test/.git/objects/ad/66f454d4713f3f8e194e9e9d2f441b0acd0e8c
Deleted test/.git/objects/b6/d19bc5afa1b991467291be0f04aae1f85ddfe1
Deleted test/.git/objects/pack/pack-645086d21d7d240bd1b10ad9acdb60ad6adda2ec.pack
Deleted test/.git/objects/54/a6af0ef41f8c3e7216e9af1b0776bf4606d6b9
Deleted test/.git/objects/be/88279fd8b45f46d00373a768c2448c2d7e93ce
Deleted test/.git/refs/remotes/origin/HEAD
Deleted test/.git/COMMIT_EDITMSG
....
```




License
=======
MIT License

Copyright (C) Kaerus 2012, Anders Elo

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



