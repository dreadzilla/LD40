// Init and remove
var initPack = {player:[],bullet:[],enemy:[]};
var removePack = {player:[],bullet:[],enemy:[]};
var collDist = 24; //Collision distance
var maxSpawnAmount = 2; // How many spawns per user allowed
var killplayerscore = 5;
var killvegscore = 1;

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
	self.maxSpd = 5,
	self.hp = 10,
	self.hpMax = 10,
	self.score = 0,
  self.highscore = 0,
	self.attackctr = 4, // keep check on attack speed.
	self.atkSpd = 0.4,
  self.maxAtkSpd = 2,
  self.bullSpd = 5,
  self.bullImg = 0,
  self.enemyAtkSpeed = 0.1

	var super_update = self.update;
	// will call both updateSpd and the Player update.
	self.update = function() {
		self.updateSpd();
		super_update();

		// Create bullet
		if (self.pressingAttack){
			self.attackctr += self.atkSpd; // restrain shooting speed
			if(self.attackctr > 4){
				self.attackctr = 0;
				self.shootBullet(self.mouseAngle)
				self.broadcastHit('gun');
			}
		}
	}
	self.shootBullet = function(angle){
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
      bullSpd:self.bullSpd,
      imgid:self.bullImg,
		});
	}

	self.updateSpd = function(){
		// Add map collision here. The user can't travel farther than the map
		// Borders are hard coded now.
		//console.log(self.x);
		if(self.pressingRight){
			if (self.x < MAPWIDTH - collDist)
				self.spdX = self.maxSpd;
			else {
				self.spdX = 0;
			}
		}
		else if(self.pressingLeft){
			if (self.x > collDist)
				self.spdX = -self.maxSpd;
			else
				self.spdX = 0;
		}
		else
			self.spdX = 0;
		if(self.pressingUp){
			if(self.y > collDist)
				self.spdY = -self.maxSpd;
			else
				self.spdY = 0;
		}
		else if(self.pressingDown){
			if(self.y < MAPHEIGHT - collDist)
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
      highscore: self.highscore,
      username: self.username,
      atkSpd: self.atkSpd,
		};
	}
	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y,
			hp: self.hp,
			score: self.score,
      highscore: self.highscore,
      username: self.username,
      atkSpd: self.atkSpd,
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
		bullet:Bullet.getAllInitPack(),
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
	// Remove possible enemies connected to this player
	if (Player.list[socket.id] !== undefined){
		// console.log('Player id:'+socket.id);
		// console.log('Player id:'+Player.list[socket.id].username);
		for(var i in Enemy.list){
			if (Enemy.list[i].playerfav === socket.id){
				// console.log('remove enemy ' + Enemy.list[i].playerfav);
				Enemy.list[i].toRemove = true;
			}
		}
		// Broadcast new player.
		for (var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',Player.list[socket.id].username+': left the server.');
		}
	}
	// Remove player from list
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
    self.spdX = Math.cos(param.angle/180*Math.PI) * param.bullSpd;
    self.spdY = Math.sin(param.angle/180*Math.PI) * param.bullSpd;
		self.parent = param.parent;
    self.timer = 0;
    self.toRemove = false,
    self.imgid = param.imgid; // 0 is default image
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
						self.broadcastHit('playerkill');
						var shooter = Player.list[self.parent];
						if(shooter) {
							shooter.score += killplayerscore; // Give score for killing other player
							if (shooter.score > shooter.highscore) {
	              shooter.highscore = shooter.score;
	            }
              // Broadcast kill.
  						for (var i in SOCKET_LIST){
  							SOCKET_LIST[i].emit('addToChat',shooter.username+' killed '+p.username
  							+'. What a loser! :) --'+ shooter.username+ '\'s score is now: '+shooter.score);
  						}
						} else {
              // Broadcast kill.
  						for (var i in SOCKET_LIST){
  							SOCKET_LIST[i].emit('addToChat',p.username+' was killed by a Veggie. What a loser! :) --');
  						}
						}
            SOCKET_LIST[p.id].emit('addToChat',' You were killed! Your settings will be reset.');
            // Recreate player with full health and at random position
						p.hp = p.hpMax;
						p.x = Math.random() * MAPWIDTH;
						p.y = Math.random() * MAPHEIGHT;
            // Reset variables
            maxSpawnAmount = 2;
            p.enemyAtkSpeed = 0.1;
            p.atkSpd = 0.4;
            if (p.score > p.highscore) {
              p.highscore = p.score;
              SOCKET_LIST[p.id].emit('addToChat','--- A NEW HIGHSCORE --- : ' + p.highscore);
            }
            p.score = 0;
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
							shooter.score += killvegscore;
							if (shooter.score > shooter.highscore) {
	              shooter.highscore = shooter.score;
	            }
              if (shooter.atkSpd >= shooter.maxAtkSpd) {
                shooter.atkSpd = shooter.maxAtkSpd;
              } else {
                shooter.atkSpd = Math.round((shooter.atkSpd + 0.2) * 100) / 100;
              }
              if (shooter.enemyAtkSpeed >= shooter.maxAtkSpd) { // restrict enemy shooting speed
                shooter.enemyAtkSpeed = shooter.maxAtkSpd;
              } else {
                shooter.enemyAtkSpeed = Math.round((shooter.enemyAtkSpeed + 0.1) * 100) / 100;
              }
              maxSpawnAmount++; // Increase spawn-rate

              // Broadcast kill.
  						for (var i in SOCKET_LIST){
                SOCKET_LIST[i].emit('addToChat',shooter.username+' killed '+p.username);
  						}
						} else {
              // Broadcast kill.
  						for (var i in SOCKET_LIST){
  							SOCKET_LIST[i].emit('addToChat',p.username+' killed '+p.username);
  						}
            }

            p.toRemove=true;
            // Recreate enemy with full health and at random position
						// p.hp = p.hpMax;
						// p.x = Math.random() * MAPWIDTH;
						// p.y = Math.random() * MAPHEIGHT;
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
        imgid:self.imgid,
			}
		}
		self.getUpdatePack = function(){
			return {
				id: self.id,
				x: self.x,
				y: self.y,
        imgid:self.imgid,
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
  self.x = param.x;
  self.y = param.y;
	self.username = param.username;
	self.id = Math.random();
	self.pressingRight = false,
	self.pressingLeft = false,
	self.pressingUp = false,
	self.pressingDown = false,
	self.pressingAttack = false,
	self.mouseAngle = 0,
	self.maxSpd = 1,
	self.hp = 10,
	self.hpMax = 10,
	self.score = 0,
	self.attackctr = 0, // keep check on attack speed.
	self.atkSpd = 0.1,
  self.collDist = 24,
  self.playerfav = param.playerid,
  self.bullSpd = 2,
  self.maxAtkSpd = 2,
  self.bullImg = 1

	var super_update = self.update;
	// will call both updateSpd and the Enemy update.
	self.update = function() {
		self.updateSpd();
		super_update();
    self.updateKeyPress();
		// Create bullet
		if (self.pressingAttack){
			self.attackctr += self.atkSpd; // restrain shooting speed
			if(self.attackctr > 4){
				self.attackctr = 0;
				self.shootBullet(self.mouseAngle)
				self.broadcastHit('gunau');
			}
		}
	}
  self.updateKeyPress = function(){
    var player = Player.list[self.playerfav];
    // console.log('Player: ' + player);
    //console.log('Player idfav:'+self.playerfav);
    if (player !== undefined) {
      var diffX = player.x - self.x;
  		var diffY = player.y - self.y;

  		self.pressingRight = diffX > self.collDist;
  		self.pressingLeft = diffX < -self.collDist;
  		self.pressingDown = diffY > self.collDist;
  		self.pressingUp = diffY < -self.collDist;
      self.pressingAttack = Math.random() >= 0.7; // Randomly press attack. Also depends on attackctr above.
      self.atkSpd = player.enemyAtkSpeed;
      self.bullSpd = player.enemyAtkSpeed*4;
      self.mouseAngle = Math.atan2(diffY,diffX) / Math.PI * 180;
    }
	}

	self.shootBullet = function(angle){
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
      bullSpd:self.bullSpd,
      imgid:self.bullImg,
		});
	}

	self.updateSpd = function(){
		// Add map collision here. The enemy can't travel farther than the map
		// Borders are hard coded now.
		if(self.pressingRight){
			if (self.x < MAPWIDTH - self.collDist)
				self.spdX = self.maxSpd;
			else {
				self.spdX = 0;
			}
		}
		else if(self.pressingLeft){
			if (self.x > self.collDist)
				self.spdX = -self.maxSpd;
			else
				self.spdX = 0;
		}
		else
			self.spdX = 0;
		if(self.pressingUp){
			if(self.y > self.collDist)
				self.spdY = -self.maxSpd;
			else
				self.spdY = 0;
		}
		else if(self.pressingDown){
			if(self.y < MAPHEIGHT-self.collDist)
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
Enemy.spawnEnemy = function(){
  // Spawn enemies only if fewer than allowed
  if (Object.keys(Player.list).length * maxSpawnAmount > Object.keys(Enemy.list).length) {
    var username = 'Veggie';
    var x = Math.random() * MAPWIDTH;
    var y = Math.random() * MAPHEIGHT
    // Designate a favourite player for the enemy. It is ranndom and unfair :)
    var keys = Object.keys(Player.list);
    var playerid = Player.list[keys[ keys.length * Math.random() << 0]].id;
    //console.log('playerid: ' + playerid);
    var enemy = Enemy({
  		username:username,
      x:x,
      y:y,
      playerid:playerid,
  	});
    // console.log('will spawn enemy no: '+ Object.keys(Enemy.list).length);
    // Announce the arrival of enemy!
  	for (var i in SOCKET_LIST){
  		SOCKET_LIST[i].emit('addToChat',' A terrible '+username+' materializes from the ground.');
  	}
  }
  //console.log('called spawnEnemy:' + Object.keys(Player.list).length);
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
// End Enemy class
