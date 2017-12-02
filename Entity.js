// Init and remove
var initPack = {player:[],bullet:[],enemy:[]};
var removePack = {player:[],bullet:[],enemy:[]};
var collDist = 32; //Collision distance

// Entity class
Entity = function(param) {
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	if(param){
		if(param.x)
			self.x = param.x;
		if(param.y)
			self.y = param.y;
		if(param.map)
			self.map = param.map;
		if(param.id)
			self.id = param.id;
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function() {
		self.x += self.spdX;
		self.y += self.spdY;
		//console.log(self.x);
	}
	self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
  }
	self.broadcastHit = function(action){
		for (var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('sndPlayerHit',action);
		}
	}
	return self;
}
// Send updated data
Entity.getFrameUpdateData = function(){
	var pack = {
		initPack:{
			player:initPack.player,
			bullet:initPack.bullet,
      enemy:initPack.enemy,
		},
		removePack:{
			player:removePack.player,
			bullet:removePack.bullet,
      enemy:removePack.enemy,
		},
		updatePack:{
			player:Player.update(),
			bullet:Bullet.update(),
      enemy:Enemy.update(),
		}
	};
	initPack.player = [];
	initPack.bullet = [];
  initPack.enemy = [];
	removePack.player = [];
	removePack.bullet = [];
  removePack.enemy = [];
	return pack;
}
//
// CLASS PLayer class with player based stuff
//
// Create a player with start position, number and ID and other data
Player = function(param){
	var self = Entity(param);
  self.x = Math.random() * MAPWIDTH; // Spawn randomly
  self.y = Math.random() * MAPHEIGHT;
	self.username = param.username;
	self.number = "" + Math.floor(10*Math.random());
	self.pressingRight = false,
	self.pressingLeft = false,
	self.pressingUp = false,
	self.pressingDown = false,
	self.pressingAttack = false,
	self.mouseAngle = 0,
	self.maxSpd = 10,
	self.hp = 10,
	self.hpMax = 10,
	self.score = 0,
	self.attackctr = 0, // keep check on attack speed.
	self.atkSpd = 1

	var super_update = self.update;
	// will call both updateSpd and the Player update.
	self.update = function() {
		self.updateSpd();
		super_update();

		// Create bullet
		if (self.pressingAttack){
			self.attackctr += self.atkSpd; // restrain shooting speed
			if(self.attackctr > 3){
				self.attackctr = 0;
				self.shootBullet(self.mouseAngle)
				self.broadcastHit('gun');
			}
			//for (var i = -3; i<3;i++)
			//	self.shootBullet(i*10+self.mouseAngle);

		}
	}
	self.shootBullet = function(angle){
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
		});
	}

	self.updateSpd = function(){
		// Add map collision here. The user can't travel farther than the map
		// Borders are hard coded now.
		//console.log(self.x);
		if(self.pressingRight){
			if (self.x < 770)
				self.spdX = self.maxSpd;
			else {
				self.spdX = 0;
			}
		}
		else if(self.pressingLeft){
			if (self.x > 30)
				self.spdX = -self.maxSpd;
			else
				self.spdX = 0;
		}
		else
			self.spdX = 0;
		if(self.pressingUp){
			if(self.y > 30)
				self.spdY = -self.maxSpd;
			else
				self.spdY = 0;
		}
		else if(self.pressingDown){
			if(self.y < 550)
				self.spdY = self.maxSpd;
			else
				self.spdY = 0;
		}
		else
			self.spdY = 0;
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			hp: self.hp,
			hpMax: self.hpMax,
			score: self.score,
		};
	}
	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y,
			hp: self.hp,
			score: self.score,
		};
	}
	Player.list[self.id] = self;
	initPack.player.push(self.getInitPack());
	return self;
}

Player.list = {};
Player.onConnect = function(socket,username){
	var player = Player({
		username:username,
		id:socket.id,
    socket:socket,
	});

	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	// Send chats out.
	socket.on('sendMsgToServer',function(data){
		for (var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',player.username+': '+data);
		}
	});
	// Initialize player stuff
	socket.emit('init', {
		selfId:socket.id, //refer player
		player:Player.getAllInitPack(),
		bullets:Bullet.getAllInitPack(),
    enemy:Enemy.getAllInitPack(),
	})
	// Broadcast new player.
	for (var i in SOCKET_LIST){
		SOCKET_LIST[i].emit('addToChat',player.username+': Joins the server.');
	}

}
Player.getAllInitPack = function(){
	var players = [];
	for (var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}
// Remove disconnected player
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	var pack = [];
	// Go through player list and update their data.
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());
	}
	return pack;
}
// End Player class
//
// CLASS Bullet class
//
Bullet = function(param){
    var self = Entity(param);
    self.id = Math.random();
		self.angle = param.angle;
    self.spdX = Math.cos(param.angle/180*Math.PI) * 10;
    self.spdY = Math.sin(param.angle/180*Math.PI) * 10;
		self.parent = param.parent;
    self.timer = 0;
    self.toRemove = false;
		// Override update loop
    var super_update = self.update;
    self.update = function(){
    	if(self.timer++ > 100)
        self.toRemove = true;
      super_update();
      // Check for player collision
			for(var i in Player.list){
				var p = Player.list[i];
				if(self.getDistance(p) < collDist && self.parent !== p.id){
					// Handle possible collision here
					p.hp -= 1;
					self.broadcastHit('enemyhit'); //Send audio
					if (p.hp <= 0){
						self.broadcastHit('enemykill');
						var shooter = Player.list[self.parent];
						if(shooter) {
							shooter.score += 1;
						}
						// Broadcast kill.
						for (var i in SOCKET_LIST){
							SOCKET_LIST[i].emit('addToChat',shooter.username+' killed '+p.username
							+'. What a loser! :) --'+ shooter.username+ '\'s score is now: '+shooter.score);
						}
            // Recreate player with full health and at random position
						p.hp = p.hpMax;
						p.x = Math.random() * MAPWIDTH;
						p.y = Math.random() * MAPHEIGHT;
					}
					self.toRemove=true;
				}
			}
      // Check for enemy collition
      for(var i in Enemy.list){
				var p = Enemy.list[i];
				if(self.getDistance(p) < p.collDist && self.parent !== p.id){
					// Handle possible collision here
					p.hp -= 1;
					self.broadcastHit('enemyhit'); //Send audio
					if (p.hp <= 0){
						self.broadcastHit('enemykill');
						var shooter = Player.list[self.parent];
						if(shooter) {
							shooter.score += 1;
						}
						// Broadcast kill.
						for (var i in SOCKET_LIST){
							SOCKET_LIST[i].emit('addToChat',shooter.username+' killed '+p.username
							+'. What a loser! :) --'+ shooter.username+ '\'s score is now: '+shooter.score);
						}
            // Recreate player with full health and at random position
						p.hp = p.hpMax;
						p.x = Math.random() * MAPWIDTH;
						p.y = Math.random() * MAPHEIGHT;
					}
					self.toRemove=true;
				}
			}
    }
		self.getInitPack = function(){
			return {
				id:self.id,
				x:self.x,
				y:self.y,
			}
		}
		self.getUpdatePack = function(){
			return {
				id: self.id,
				x: self.x,
				y: self.y,
			}
		}
    Bullet.list[self.id] = self;
		initPack.bullet.push(self.getInitPack());
    return self;
}
Bullet.getAllInitPack = function(){
	var bullets = [];
	for (var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}

Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	// Go through bullet list and update their data.
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove) {
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else {
			pack.push(bullet.getUpdatePack());
		}
	}
	return pack;
}
//
// END Bullet class
//
// Enemy class
//
// Create an enemy with start position, number and ID and other data
Enemy = function(param){
	var self = Entity(param);
  // Spawn location
  self.x = 100;
  self.y = 100;
	self.username = param.username;
	self.id = Math.random();
	self.pressingRight = false,
	self.pressingLeft = false,
	self.pressingUp = false,
	self.pressingDown = false,
	self.pressingAttack = false,
	self.mouseAngle = 0,
	self.maxSpd = 10,
	self.hp = 10,
	self.hpMax = 10,
	self.score = 0,
	self.attackctr = 0, // keep check on attack speed.
	self.atkSpd = 1,
  self.collDist = 24

	var super_update = self.update;
	// will call both updateSpd and the Enemy update.
	self.update = function() {
		self.updateSpd();
		super_update();

		// Create bullet
		if (self.pressingAttack){
			self.attackctr += self.atkSpd; // restrain shooting speed
			if(self.attackctr > 3){
				self.attackctr = 0;
				self.shootBullet(self.mouseAngle)
				self.broadcastHit('gun');
			}
			//for (var i = -3; i<3;i++)
			//	self.shootBullet(i*10+self.mouseAngle);
		}
    for(var i in Player.list){
      var p = Player.list[i];
      if(self.getDistance(p) < collDist && self.parent !== p.id){
        // Handle possible collision here
        p.hp -= 1;
        self.broadcastHit('enemyhit'); //Send audio
        if (p.hp <= 0){
          self.broadcastHit('enemykill');
          self.score += 1;
          // Broadcast kill.
          for (var i in SOCKET_LIST){
            SOCKET_LIST[i].emit('addToChat',self.username+' killed '+p.username
            +'. What a loser! :) --'+ self.username+ '\'s score is now: '+self.score);
          }
          p.hp = p.hpMax;
          p.x = Math.random() * MAPWIDTH;
          p.y = Math.random() * MAPHEIGHT;
        }
        //self.toRemove=true;
      }
    }
	}
	self.shootBullet = function(angle){
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
		});
	}

	self.updateSpd = function(){
		// Add map collision here. The enemy can't travel farther than the map
		// Borders are hard coded now.
		//console.log(self.x);
		if(self.pressingRight){
			if (self.x < 770)
				self.spdX = self.maxSpd;
			else {
				self.spdX = 0;
			}
		}
		else if(self.pressingLeft){
			if (self.x > 30)
				self.spdX = -self.maxSpd;
			else
				self.spdX = 0;
		}
		else
			self.spdX = 0;
		if(self.pressingUp){
			if(self.y > 30)
				self.spdY = -self.maxSpd;
			else
				self.spdY = 0;
		}
		else if(self.pressingDown){
			if(self.y < 550)
				self.spdY = self.maxSpd;
			else
				self.spdY = 0;
		}
		else
			self.spdY = 0;
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			// number:self.number,
			hp: self.hp,
			hpMax: self.hpMax,
			score: self.score,
		};
	}
	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y,
			hp: self.hp,
			score: self.score,
		};
	}
	Enemy.list[self.id] = self;
	initPack.enemy.push(self.getInitPack());
	return self;
}

Enemy.list = {};
Enemy.spawnEnemy = function(username){
	var enemy = Enemy({
		username:username,
	});

	// socket.on('keyPress',function(data){
	// 	if(data.inputId === 'left')
	// 		player.pressingLeft = data.state;
	// 	else if(data.inputId === 'right')
	// 		player.pressingRight = data.state;
	// 	else if(data.inputId === 'up')
	// 		player.pressingUp = data.state;
	// 	else if(data.inputId === 'down')
	// 		player.pressingDown = data.state;
	// 	else if(data.inputId === 'attack')
	// 		player.pressingAttack = data.state;
	// 	else if(data.inputId === 'mouseAngle')
	// 		player.mouseAngle = data.state;
	// });
	// Send chats out.
	// socket.on('sendMsgToServer',function(data){
	// 	for (var i in SOCKET_LIST){
	// 		SOCKET_LIST[i].emit('addToChat',enemy.username+': '+data);
	// 	}
	// });
	// Initialize player stuff
	// socket.emit('init', {
	// 	selfId:socket.id, //refer player
	// 	player:Player.getAllInitPack(),
	// 	bullets:Bullet.getAllInitPack(),
  //   enemy:Enemy.getAllInitPack(),
	// })
	// Broadcast new enemy.
	for (var i in SOCKET_LIST){
		SOCKET_LIST[i].emit('addToChat',' The terrible '+enemy.username+' materializes from the nether.');
	}
}
Enemy.getAllInitPack = function(){
	var enemies = [];
	for (var i in Enemy.list)
		enemies.push(Enemy.list[i].getInitPack());
	return enemies;
}

Enemy.update = function(){
	var pack = [];
	// Go through player list and update their data.
	for(var i in Enemy.list){
		var enemy = Enemy.list[i];
		enemy.update();
    if(enemy.toRemove) {
      delete Enemy.list[i];
      removePack.enemy.push(enemy.id);
    } else {
      pack.push(enemy.getUpdatePack());
    }
	}
	return pack;
}
// End Player class
