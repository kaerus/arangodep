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
$ arangodep route -u com/kaerus -v
options.url: com/kaerus
{ _id: '27804071/858341799',
  _rev: 858341799,
  url: 'com/kaerus/modules',
  action: '/org.arangodb/actions/routes' }
```

Alter a route by specifying the route id and what you need to change.
```
$ arangodep route -i 27804071/858341799 -a /org/arangodb/actions/routes
Route updated:  { url: 'com/kaerus/modules',
  action: '/org/arangodb/actions/routes' }
```

To get a list of all routes use ```--view```without the url option.
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

To delete a route you can specify the route with ```--id <id>``` and ```--delete```.
```
$ arangodep route --id 27804071/855327143 --delete
Route deleted:  { action: 'org/kaerus/modules/routing',
  url: { constraint: 'nada', match: '/test/dummy' },
  _id: '27804071/855327143',
  _rev: 855327143 }
```

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
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2012 Kaerus (kaerus.com), <anders elo @ kaerus com>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.