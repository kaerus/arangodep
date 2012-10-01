arangodep
=========

Arango deployment tool 

Install
-------
```
sudo npm install https://github.com/kaerus/arangodep -g
```

Usage
-----
Execute ```arangodep``` to see command options.

Example
-------
Deploy files from current directory to ```admin``` collection under ```miia``` base index.

```
$ arangodep --upload ./ http://127.0.0.1:8529/admin:miia
* Skipping file: ./.index
Files .index: { remote: 'http://127.0.0.1:8529/admin:miia',
  basedir: 'miia',
  paths: [ '/css', '/images', '/js' ],
  files: 
   [ 'css/bh.css',
     'images/background_darksepia.png',
     'images/front_page.png',
     'index.html',
     'js/advanced.js',
     'js/app.js',
     'js/tabs.js',
     'js/wysihtml5-0.3.0.min.js' ] }
```     

Download files from the ```admin``` collection ```miia``` base index to current directory.
```
arangodep --download http://127.0.0.1:8529/admin:miia ./
{ remote: 'http://127.0.0.1:8529/admin:miia',
  basedir: 'miia',
  paths: [ '/css', '/images', '/js' ],
  files: 
   [ 'css/bh.css',
     'images/background_darksepia.png',
     'images/front_page.png',
     'index.html',
     'js/advanced.js',
     'js/app.js',
     'js/tabs.js',
     'js/wysihtml5-0.3.0.min.js' ] }
Creating directory: ./css
Creating directory: ./images
Creating directory: ./js
Downloading miia/index.html (6746 bytes)
Downloading miia/js/advanced.js (13606 bytes)
Downloading miia/images/background_darksepia.png (6816 bytes)
Downloading miia/css/bh.css (4575 bytes)
Downloading miia/images/front_page.png (141170 bytes)
Downloading miia/js/tabs.js (1396 bytes)
Downloading miia/js/wysihtml5-0.3.0.min.js (112525 bytes)
```
Warning, this is for test purposes only, use at your own risk! 

License
=======
MIT License

Copyright (C) Kaerus 2012, Anders Elo

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



