
var redis = require('redis');
var async = require('async');
var moment = require('moment');

module.exports = function(sc,job,isStop){
	if( isStop === true ){
		return stopJob( sc,job );
	}else{
		return runJob( sc,job );
	}
};


var g_Handler = null;

/*
var g_conf = {
	"redis":{ "host":"127.0.0.1","port":6379 },
	"keys":[
		{
			"name":"清理zset类型",
			"type":"zset",
			"match":"*:Pool:his",
			"action":{
				"valueType":"int|eval|dateStamp",
				"paramType":"int|eval",
				"style" : "rank|score",
				"min"    : "0|date",
				"max"    : "999|date-1"
			}
		},
		{
			"name":"清理list类型",
			"type":"list",
			"match":"*:Pool:his",
			"action":{
				"valueType":"int|eval|dateStamp",
				"paramType":"int|eval",
				"style" : "rem|trim",
				"min"    : "0|date",       // use for trim
				"max"    : "999|date-1"    // use for trim
				"count"  : "1",           // use for rem
				"value"  : ""             // use for rem 
			}
		},
		{
			"name":"清理key",
			"type":"key",
			"match":"pt:[0-9]*",
			"action":{
				"regex":"pt:[int|date]",
				"matchType":"int|string|dateStamp",
				"min"    : "0|date - n",
				"max"    : "999|date"
			}
		},
	]

};
*/
var g_conf = {
	"redis":{ "host":"127.0.0.1","port":6379 },
	"keys":[
		{
			"name":"清理zset类型",
			"type":"zset",
			"match":"*:Pool:his",
			"action":{
				"style" : "score",
				"min"   : "'-inf'",
				"max"   : "parseInt((new Date()).valueOf()/1000) - 86400 * 30",
				"regex":"([0-9]{8}):*",
				"attr":[
					{
						"matchType":"string",
						"min"    : "50901800",
						"max"    : ""
					}
				]
			}
		},
		{
			"name":"清理 List",
			"type":"list",
			"match":"brnn:winls",
			"action":{
				"style":"trim",
				"min"  : 0,
				"max"  : 3
			}
		},
		{
			"name":"清理key",
			"type":"key",
			"match":"rcard:20??????:*:*",
			"action":{
				"expire":36000,
				"regex":"([0-9]{8}):([0-9]{1,}):([0-9]{1,})",
				"attr":[
					{
						"matchType":"dateStamp",
						"min"    : "0",
						"max"    : "(new Date()).valueOf() - 86400 * 30000"
					},
					{
						"matchType":"int",
						"min"    : "0",
						"max"    : "3"
					},
					{
						"matchType":"string",
						"min"    : "5",
						"max"    : ""

					}
				]
			}
		},
	]

};


function runJob(sc, job)
{
	if( g_Handler === null){
		g_Handler = new Handler( sc,job );
	}

	g_Handler.run();

	return "";
}

function stopJob(sc, job)
{
	if( g_Handler !== null ){
		g_Handler.stop();
	}

	return "";
}


var Handler = function( sc, job){
	console.log(' init ');
	this._sc = sc;
	this._job = job;
	this._isRun = false;
	this.redis = null;

	var tmp = sc.getConfig( job['name']);
	
	this._cfg = g_conf;
};


Handler.prototype.run = function(){

	if( this._isRun === true ) {
		console.log( "redisClean has running..." );
		return;
	}

	this._isRun = true;
	// init redis
	connectRedis( this );
};

//! Stop
Handler.prototype.stop = function(){
	this._isRun = false;
	if( this.redis !== null ){
		disconnectRedis( this );
	}
};


Handler.prototype.cleanRedis = function( keyInfo,cb ){
	var self = this;
	var type = keyInfo.type.toLowerCase();
	switch( keyInfo.type ){
		case "zset":
		{
			self.cleanZSet( keyInfo,cb );
		}break;
		case "list":
		{
			self.cleanList( keyInfo, cb );
		}break;
		case "key":
		{
			self.cleanKey( keyInfo, cb );
		}break;
		default:
		{
			console.log('xx does not support type!');
			cb(  null );
		}break;
	}
} 


Handler.prototype.cleanKey = function( keyInfo,cb ){
	var self = this;

	var act = keyInfo.action;
	var param = getParam( keyInfo.type,act );
	//console.log( param );
	
	/// 查找键，清理键
	async.waterfall([
    function(callback) {
		self.redis.keys( keyInfo.match, function( err, reply ){
			callback( err, reply );
		});
    },
    function( keys, callback) {
		var i=0,j=0;
		var lenParam = param.params.length;
		var lenKey = keys.length;
		for ( i=0; i<lenKey; i++ ){
			if( checkParams( keys[i], param ) === true ){
				self.redis.expire( keys[i], param.expire);
			}
		}

		callback(null, 'three');
    },
	], function (err, result) {
		cb( err );
	});
	
	//
	cb( null );
}

Handler.prototype.cleanZSet = function( keyInfo,cb ){
	var self = this;
	
	var act = keyInfo.action;
	var param = getParam( keyInfo.type,act );
	var style = param.style;
	//console.log( param );
	
	/// 查找键，清理键
	async.waterfall([
    function(callback) {
		self.redis.keys( keyInfo.match, function( err, reply ){
			callback( err, reply );
		});
    },
    function( keys, callback) {
		var i = 0;
		var lenKey = keys.length;
		for ( i=0; i<lenKey; i++ ){
			if( checkParams( keys[i], param ) === true ){
				if( style === "rank" ){
					self.redis.zremrangebyrank( keys[i], param.min, param.max );
				}else{
					self.redis.zremrangebyscore( keys[i], param.min, param.max );
				}
			}
		}

		callback(null, 'three');
    },
	], function (err, result) {
		cb( err );
	});
	
};

Handler.prototype.cleanList = function( keyInfo,cb ){
	var self = this;
	
	var act = keyInfo.action;
	var param = getParam( keyInfo.type,act );
	var style = param.style;
	//console.log( param );
	
	/// 查找键，清理键
	async.waterfall([
    function(callback) {
		self.redis.keys( keyInfo.match, function( err, reply ){
			callback( err, reply );
		});
    },
    function( keys, callback) {
		var i = 0;
		var lenKey = keys.length;
		for ( i=0; i<lenKey; i++ ){
			if( checkParams( keys[i], param ) === true ){
				if( style === "rem" ){
					self.redis.lrem( keys[i], param.min, param.max );
				}else{
					self.redis.ltrim( keys[i], param.min, param.max );
				}
			}
		}

		callback(null, 'three');
    },
	], function (err, result) {
		cb( err );
	});

}


function getParam( type,act ){
	var ret = { "regex":null,"params":[]};

	var min=0,max=999999;
	if( act.style !== undefined ){
		var style = act.style.toLowerCase();
		switch( style ){
			case "rem":
			{
				min = act.count;
				max = act.value;
			}break;
			default:{
				min = act.min;
				max = act.max;
			}break;
		}
		ret.min = eval(min);
		ret.max = eval(max);
		ret.style = style;
	}

	/// 取参数
	if( act.regex !== undefined ){
		ret.regex = new RegExp( act.regex );
	}

	ret.expire = ( act.expire !== undefined )?act.expire:900;
	if( act.attr !== undefined ){
		var lenPara = act.attr.length;
		var i = 0;
		for( i=0; i<lenPara; i++){
			var para = act.attr[i];
			////
			ret.params.push( {
				"matchType":para.matchType.toLowerCase(),
				"min":eval(para.min),"max":eval(para.max)} );
		}
	}

	return ret;
}


function checkParams( key, param){
	//console.log( "--- checkParams:", key,param );
	////
	if( param.regex === null ){
		return true;
	}

	var mat = param.regex.exec( key );
	var lenParam = param.params.length;
	var bRM = true;
	for( j=0;j<lenParam;j++ ){
		var matchVal = mat[j + 1];
		var paraInfo = param.params[j];
		switch( paraInfo.matchType ){
			case "int":
			{
				if( matchVal < paraInfo.min || matchVal > paraInfo.max ){
					bRM = false;
				}
				
				//console.log( "-- int, ", matchVal, paraInfo.min, paraInfo.max,bRM );
			}break;
			case "datestamp":
			{
				var p = moment( matchVal ).valueOf();
				if( p < paraInfo.min || p > paraInfo.max ){
					bRM = false;
				}

				//console.log( "-- datestamp, ", p, paraInfo.min, paraInfo.max,bRM  );
			}break;
			case "string":
			{
				if( matchVal != paraInfo.min ){
					bRM = false;
				}

				//console.log( "-- string, ", matchVal, paraInfo.min,bRM  );
			}break;
		}

		if( bRM === false ){
			break;
		}
	}

	//console.log( "--- checkParams ret:", bRM );
	return bRM;
}



function connectRedis( self ){
	self.redis = redis.createClient( self._cfg.redis );
	self.redis.on("error",function( err ){
		console.log("Error " + err);
	});

	self.redis.on("connect",function( err ){
		console.log("-- Connect to redis.");
		if( !err ){
			startClean( self );
		}
	});
}

function disconnectRedis( self ){
	self.redis.quit();
	self.redis = null;
	console.log("-- DisConnect from redis.");
}

//! 开始清理
function startClean( self ){
	//console.log( self._cfg );
	self._cleanKeys = self._cfg.keys;

	setTimeout( function(){
		cleanKey( self );
	},500);
}

function cleanKey( self )
{
	var key = self._cleanKeys.shift();
	if( key === undefined ) {
		self.stop();
		self._sc.stopJob( self._job['name'] );
		return;
	}

	/// 
	console.log( '----- clear key:', key.name );
	self.cleanRedis( key, function( err ){
		if( err ) { 
			console.log( err ); 
			return; 
		}else{
			setTimeout( function(){
				cleanKey( self );
			},1000);
		}
	});
}
