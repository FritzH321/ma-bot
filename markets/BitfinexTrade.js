var fs = require('fs');
var utils = require("../utils");
var request = require("request");
var keys = JSON.parse(fs.readFileSync(__dirname+'/keys.json', 'utf8'));
var bitfinexApiNode = require("./api/bitfinex.js");
var bitfinex = new bitfinexApiNode(keys["bitfinex"]["key"], keys["bitfinex"]["secret"]);
const TAG = "Bitfinex";
var console = process.console;


function BitfinexTrade(pairs){
	
	this.initAmout = 100;
	
	
	this.balanceMatrix = {};
}

BitfinexTrade.prototype.updateBalance = function(callback){
	var self = this;
	console.log("Requesting balances");
	bitfinex.wallet_balances(function(err, data){
		console.log("Requesting balance at Bitfinex");
		if(!err){
				var funds ={};
				for (var i=0; i<data.length; i++){
					if(data[i]["type"]==="exchange"){
						if(data[i]["available"]){
							funds[data[i]["currency"]] = data[i]["available"];
						}
										
					}
									
									
				}
				self.balanceMatrix = funds;
				console.log(self.balanceMatrix);
				callback();
								
								
		}else{
			console.log(err.toString());
		}
	});
}

BitfinexTrade.prototype.getBalance = function(pair, mode){
	switch(mode){
		case "buy":
			curr =pair.substr(3);
		break;
		case "sell":
			curr =pair.substr(0,3);
		break;
		}
	return parseFloat(this.balanceMatrix.bitfinex[curr.toLowerCase()]) || 0;
}

BitfinexTrade.prototype.getTicker = function(pair, callback){
	bitfinex.ticker(pair, function(err, data){
		if(!err){
			return callback(pair,data);
		}else{
			console.tag(TAG).log(err.toString());
		}
	});

}

BitfinexTrade.prototype.getHistData = function(pair, period, limit, callback){
	const startDate = utils.generateStartDate(period,limit)*1000;
	 var url = "https://api.bitfinex.com/v2/candles/trade:30m:t"+pair+"/hist?sort=1&start="+startDate+"&limit="+limit;
	 request({
        url: url,
        method: "GET",
       
        timeout: 15000
    }, function (err, response, body) {
    	if(!err){
    		return callback(pair, JSON.parse(body));
    	}else{
    		console.tag(TAG).log(err.toString());
    	}
    });
}

BitfinexTrade.prototype.testTrade = function(pair, price, amount, action,  callback){
	switch(action){
		case "buy":
		this.initAmout-=amount*price;
		
		return callback();
		case "sell":
		this.initAmout+=0.9975*amount*price;
		
		return callback();
	}
};


/*
BitfinexTrade.prototype.getOrders = function(){
	var self = this;
	bws.on('orderbook', (pair, book) => {
		if(!self.orderbook.hasOwnProperty(pair)){
			self.orderbook[pair]={
				"bids":{
					"price":0,
					"amount":0
				},
				"asks":{
					"price":0,
					"amount":0
				}

			}
		}
		if(book["amount"]>0){
			self.orderbook[pair]["bids"]["price"]=parseFloat(book["price"]);
			self.orderbook[pair]["bids"]["amount"]=parseFloat(book["amount"]);
		}else{
			self.orderbook[pair]["asks"]["price"]=parseFloat(book["price"]);
			self.orderbook[pair]["asks"]["amount"]=parseFloat(book["amount"])*-1;
		}
		
	})
	
};

BitfinexTrade.prototype.trade = function(pair, rate, amount, callback){
	var self= this;
	console.tag("Bitfinex").log(pair+" Entering into trade");
	bitfinex.new_order(pair, amount.toString(), rate.toString(), "bitfinex", self.mode, "exchange limit", function(err, data){
		if(!err){
				console.tag("Bitfinex").log(pair+" Order was created: rate "+rate +" amount "+ amount+ " id "+data["id"]);
				setTimeout(function(){
					checkOrder(self, pair, data["id"], function(){
						callback();
					});
		
				},1000);
		}else{
			
			console.tag("Bitfinex").log(err.toString());
		}
	}); 
	
};

function checkOrder(self, pair, orderId, callback){
	//called on each iteration
	checkAttempt++;
	if(checkAttempt < maxCheckAttempts){
		if(orderId && orderId !==0){
			bitfinex.active_orders(function(err, data){
			
				if(!err){
					var activeOrders = [];
					for(var order=0; order<data.length; order++){
						activeOrders.push(String(data[order]["id"]));
					}
					if(activeOrders.indexOf(orderId.toString()) > -1){
							setTimeout(function(){
								return	checkOrder(self, pair, orderId, callback);
							},2000);
							
					}else{
						console.tag("Bitfinex").log(pair+" Order has been closed");
						//reset check attepmts
						checkAttempt=0;
						return	callback();
					}
					
				}else {
						console.tag("Bitfinex").log(err.toString());
						setTimeout(function(){
							return	checkOrder(self, pair, orderId, callback);
						},2000);

						
						
					}
			});
		}else{
				console.tag("Bitfinex").log(pair+" Order Executed immidiately");
				//reset check attepmts
				checkAttempt=0;
				return callback();
			}
	}else{
		console.tag("Bitfinex").log(pair+"Max number of checks exceeded. Leaving order");
		//reset check attepmts
		checkAttempt=0;
		return callback();
	}
}


BitfinexTrade.prototype.getBalance = function(pair, callback){
	var self = this;
	bitfinex.wallet_balances(function(err, data){
		
		var buyCurr =pair.substr(3);
		
		var sellCurr =pair.substr(0,3);
		
		
		if(!err){
		for(var i=0; i<data.length; i++){
			
					if(data[i]["currency"] === buyCurr){
						var buyAmount = parseFloat(data[i]["available"]);
						
						
					}
				
					if(data[i]["currency"] === sellCurr){
						var sellAmount = parseFloat(data[i]["available"]);
						
					
					}
				
			}
		return callback({
			[buyCurr]: buyAmount,
			[sellCurr]: sellAmount
		});
			
		}else {
			console.tag("Bitfinex").log(err);
			return callback({
			[buyCurr]: -Infinity,
			[sellCurr]: -Infinity
		});
		}
		

		
	});
}; */



module.exports =BitfinexTrade;