// The more you have, the worse it is theme game create for Ludum Dare 40
// Author: Hakan Staby, 2017-Dec-02
require('./Entity');

var express = require('express');
var app = express();
var serv = require('http').Server(app);
var DEBUG = true;
// Global vars
MAPWIDTH = 1000;
MAPHEIGHT = 600;
SOCKET_LIST = {};
var frameCount = 0;

// Redirect to start file if /
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
// Only allow downloads from /client
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log('Server started.');

var isValidPassword = function(data,cb){
	return cb(true);
}
var isUsernameTaken = function(data,cb){
	return cb(false);
}
var addUser = function(data,cb){
	return(cb);
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	// Give each person connecting their own id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	socket.on('signIn',function(data){
		isValidPassword(data,function(res){
	  	if(res){
	    	Player.onConnect(socket,data.username);
				// Enemy.spawnEnemy('Killer Bob'); // Spawn an enemy when the player logs in
	      socket.emit('signInResponse',{success:true});
			} else {
	     	socket.emit('signInResponse',{success:false});
				console.log('signin');
	    }
	  });
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){
	  	if(res){
	    	socket.emit('signUpResponse',{success:false});
			} else {
	    	addUser(data,function(){
	  			socket.emit('signUpResponse',{success:true});
	      });
	    }
		});
	});


	//console.log('socket connection');
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('evalServer',function(data){
		if (!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);
	});
});

// SERVER GAME LOOP
// Servertick 25 times per second
setInterval(function(){
	var packs = Entity.getFrameUpdateData();
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',packs.initPack);
		socket.emit('update',packs.updatePack);
		socket.emit('remove',packs.removePack);
	}
	frameCount++;
	if (frameCount %100 === 0){ // Spawn every 4 seconds
		// console.log('SpawnEnemy');
		Enemy.spawnEnemy();
		frameCount = 0;
	}
},1000/25);
