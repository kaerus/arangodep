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
When install execute the command: arangodep to see options

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
Creating directory: ./js }
```

Warning, this is very beta

