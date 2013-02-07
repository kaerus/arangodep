arangodep
=========

Arango deployment tools.

Install
-------
```
git clone git://github.com/kaerus/arangodep
cd arangodep
npm i -g
```

Since arangodep depends on <a href="https://github.com/kaerus/program.js">program.js</a> which is under heavy development you must make sure you have the latest/correct version until the API stabilizes. In other words, check-out frequently and report issues if you experience any problems.

Usage
-----
Run ```arangodep``` from the terminal to see command options.
```
ArangoDB deployment tool version 0.5.0
Created by Kaerus <contact@kaerus.com>
Help: ?
             app: deploy application
         modules: deploy modules
          routes: configure routing
```
Type '?' after any command or option to get more help.

Warning: this tool can ruin you database, use with caution! 

Create an application
---------------------
The arangodep tool was created as a tool for deploying applications into the ArangoDB.
Its purpose is to simplify the process of creating routes and deploying modules and other content into the Arango database.

```
bash-3.2$ arangodep app ?
ArangoDB deployment tool version 0.5.3
Created by Kaerus <contact@kaerus.com>
Help: app
                 add: Add source file
               fetch: Fetch files from remote
                init: Application init
                push: Push files to remote
             reindex: reindex
               reset: reset application

```

Use ```arangodep app init remote http://hostname:port/colleciton ./destination``` to initialize a working directory for your application. This creates an ```.index```where your deployed files are being tracked.
```
bash-3.2$ arangodep app init remote http://127.0.0.1:8529/kaerus_com
Created index for: http://127.0.0.1:8529/kaerus_com
bash-3.2$ more .index 
{
  "remote": "http://127.0.0.1:8529/kaerus_com",
  "paths": {},
  "files": {},
  "created": "2013-02-07T10:48:05.614Z"
}
```

Add files to the index by using the ```arangodep app add <source-file>``` command.
```
bash-3.2$ arangodep app add ./public 
Adding public/1290032361-thin.svg
Adding public/background.png
Adding public/chatty.html
Adding public/commonstyle.css
Adding public/css/chatty.css
.............................
```

Create the remote collection and push the indexed files to the database.
```
bash-3.2$ arangodep app push create
creating index: kaerus_com
Pushing 58 files to http://127.0.0.1:8529/kaerus_com
C public/stylesheets/kaerus.css
C public/kaerus_logo_testb.png
C public/js/tabs.js
C public/tabs.js
C public/js/jquery-1.7.min.js
..........................
```

You can also update a single file and deploy it by using ```arangodep app push ./some_file```.
New files must first be included into the index by ```arangodep app add ./file``` before they can be deployed.

To download an application you issue the ```arangodep app fetch remote http://hostname:port/collection``` command.
That downloads all indexed files from the specified collection in to the destination directory.

You may also flush all files by using the ```arangodep app reset```command. This also clears both the remote and local index. Other documents (non indexed) are preserved unless you use ```arangodep app reset collection```in which case the collection is removed from the database. 

Configure routes
----------------
ArangoDB has a very flexible routing mechanism which yields a rich set of options for configuration.   
```
K1:arangodep kaerus$ arangodep routes add?
ArangoDB deployment tool version 0.5.3
Created by Kaerus <contact@kaerus.com>
Help: routes add
     remote(http://127.0.0.1:8529) <url>: ArangoDB server
                         url(*) <string>: Route url
                          methods <json>: URL methods
                       constraint <json>: URL constraints
                         action <string>: Action
                     controller <string>: Action controller
                         prefix <string>: Prefix controller
                             do <string>: Action do method
                          options <json>: Action options
                             id <string>: Patch route
 
```
We'll only be covering some of the most useful configuration directives in these examples.

The most simple routing directive is an absolute url that directs requests to a single action controller.
``` 
arangodep routes add url /simple action /com/kaerus/simple 
```
By default, only the GET & HEAD requests methods are being forwarded to the action controller. 
To forward POST, PATCH, DELETE etc you need to specify those explicitely.

``` 
arangodep routes add url /simple methods '["GET","HEAD","POST","PATCH","DELETE","PUT"]' action /com/kaerus/test 
Route added: {"url":{"match":"/simple","methods":["GET","HEAD","POST","PATCH","DELETE","PUT"]},"action":"/com/kaerus/test"}
```

Routes can be wildcarded so that for example the first portion of the url (prefix) matches.
```
 arangodep routes add url /test/* controller /com/kaerus/test
 Route added: {"url":"/test/*","action":{"controller":"/com/kaerus/test"}}
```
In this case it is required to also declare which controller to use since ArangoDB would otherwise forward requests to a controller path which also includes the wildcarded-suffix part of the url ```<controller-path>/<url-suffix>```.  


ArangoDB is able to extracts parts of the matching url and offer the content of these to the controller as parameters.
```
arangodep routes add url /users/:uid/profile
```
The content of the :uid segment is extracted as a parameter for the receiving controller so that the url ```/users/4321/profile``` would in this case produce the parameter ```uid:4321```. 


It is also possible to specify constraints on named url segments to enforce a parameter format. 
```
arangodep routes add url /users/:uid/profile constraint '{"uid":"\d{3}"}'
Route added: {"url":{"match":"/users/:uid/profile","constraint":{"uid":"[0-9]{3}"}},"action":{}}
# listing the route
    "_id": "_routing/230965671",
    "_rev": "230965671",
    "_key": "230965671",
    "action": {},
    "url": {
      "match": "/users/:uid/profile",
      "constraint": {
        "uid": "[0-9]{3}"
      }
    }
```
As shown above :uid must now be made up of three digits.

Action controllers (modules)
----------------------------
An action controller is a commonJS module that exports a set of functions to manage action requests.
By convention these exported functions are named after http request methods.
So for example to create an action controller that responds to GET requests you would exports a GET method in your module. It is however possible to configure the routing so that requests are destined to a specific function with the 'do' directive. Or even export a default 'do' function in the controller itself which would recieve all unhandled requests for that controller.

Use the modules add sub-command to deploy or update modules.
```
bash-3.2$ arangodep modules add?
ArangoDB deployment tool version 0.5.3
Created by Kaerus <contact@kaerus.com>
Help: modules add
     remote(http://127.0.0.1:8529) <url>: ArangoDB server
                        path(*) <string>: undefined
                autoload(true) <boolean>: undefined
                         force <boolean>: undefined

```
To deploy a module you only need to specify module path and source file provided that ArangoDB also runs on localhost.
```
bash-3.2$ arangodep modules add path /com/kaerus/render ./render.js 
Deployed module to path /com/kaerus/render with id _modules/231096743
```
The path is in this case is only a name in the form of an URI ```/path/for/the/module```.
Arangodep verifies the module by using a lexical parser (Esprima) to validate the syntax before deploying it to the server. 

To list the modules use the list sub-command.
```
bash-3.2$ arangodep modules list
{"_id":"_modules/8929703","_rev":"11813287","_key":"8929703","autoload":true,"path":"/com/kaerus/forms"}
{"_id":"_modules/231096743","_rev":"231096743","_key":"231096743","autoload":true,"path":"/com/kaerus/render"} 
```
You can view the contents of the module by using ```arangodep modules list view``` and select a specific module by including the id ```arangodep modules list id _modules/231096743 view```.







License
=======
   Copyright (c) 2012 Kaerus (kaerus.com), <anders elo @ kaerus com>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.