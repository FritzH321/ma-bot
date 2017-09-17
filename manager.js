var fs = require('fs');
var bfxTrade =  require("./markets/BitfinexTrade");
var bfx = new bfxTrade();

var utils = require("./utils");

const SMA = require('technicalindicators').SMA;
const ADX = require('technicalindicators').ADX;

// var smaSArray={};
// var smaLArray={};
// var adxArray={};

var console = process.console;
const TAG = "Manager";
const pairsList=["XMRBTC", "ETHBTC", "ZECBTC", "XRPBTC", "ETCBTC"];

var pairs = {}

const backtest = true;
const prevValues={};
const period = 1800*1000;
const stopLossCoeff = 0.017;
const tradeCoeff = 1;


const trendStrength = 15;
const longSMA = 100;
const shortSMA = 10;
const adxPeriods =14;

var openedPositions=0;
var success =0;
var loss=0;


function Manager(){
	
	this.runBlock = true;
	console.log("Initializing list of pairs ");
	
	 for(var pair of pairsList){
	 	pairs[pair] = {
			prevValues : {smaS: -Infinity,
							smaL: Infinity},
			smaSArray:{},
			smaLArray:{},
			adxArray :{},
			long: false,
			stopLossPrice:0,
			entryPrice:0,
			entryAmount : 0 //temporary param

		}
	// 	prevValues[pair]={smaS: -Infinity,
	// 					smaL: Infinity};
		
				
	 }
	
	var self =this;

	if(backtest){
		
		pairs["ETHBTC"]["smaLArray"] = new SMA({period : longSMA, values : []});
		pairs["ETHBTC"]["smaSArray"] = new SMA({period : shortSMA, values : []});
		pairs["ETHBTC"]["adxArray"] = new ADX({period : adxPeriods, close : [], high : [], low : []});

		self.runBlock = false;
		console.tag("Trade").log("runBlock "+self.runBlock);
	}else{

		//Add ADX for prod mode
		bfx.updateBalance(function(){
		console.log("Initializing indicators ");
		for(pair in pairs){
			bfx.getHistData(pair, period/60000, longSMA, function(resppair, data){
				
				
				var short = data.slice(data.length - shortSMA);
				//close
				var farray = [];
				//high
				var harray =[];
				//low
				var larray = [];

				var sarray = [];
				for (var d of data){
					farray.push(d[2]);
					harray.push(d[3]);
					larray.push(d[4]);
				}
				for (var s of short){
					sarray.push(s[2])
				}

				pairs[resppair]["smaLArray"] = new SMA({period : longSMA, values : farray});
				pairs[resppair]["smaSArray"] = new SMA({period : shortSMA, values : sarray});
				pairs[resppair]["adxArray"] = new ADX({period : adxPeriods, close : farray, high : harray, low : larray});
				
				
				
			});
		}

		setTimeout(function(){

			self.runBlock = false;
			console.tag("Trade").log("runBlock "+self.runBlock);
		},10000)
	});
	}
}



Manager.prototype.runBot = function(){
		var self = this;
		console.log("Starting bot");
		if(backtest){
			console.log("backtest is ON, live data is OFF");
			var marketData = JSON.parse(fs.readFileSync(__dirname+'/BFX_ETHBTC_30m.json', 'utf8'));
			
			for(var candle of marketData){
				
				analyzeData(self, "ETHBTC",candle);
			}
		}else{
			console.log("backtest is OFF, live data is ON");
			setInterval(function(){
				if(!self.runBlock){
					for(var pair in pairs){
						bfx.getTicker(pair, function(respair, data){
						analyzeData(self, respair,data);
						});
					}
				}
			}, period);
		}
};



function analyzeData(self, respair,data){
	var close, high, low =0;
	if(backtest){
		close = data[2];
		high = data[3];
		low = data[4];
	}else{
		close = parseFloat(data["last_price"]);
		high = parseFloat(data["high"]);
		low = parseFloat(data["low"]);

	}

	var adx= pairs[respair]["adxArray"].nextValue({close :close, high: high, low, low})
	var smaS = pairs[respair]["smaSArray"].nextValue(close);
	var smaL = pairs[respair]["smaLArray"].nextValue(close);

	if(adx != undefined && adx["adx"] > trendStrength && !pairs[respair]["long"]&& !pairs[respair]["short"]){
		//open long position if conditions are met
		if(pairs[respair]["prevValues"]["smaS"] <pairs[respair]["prevValues"]["smaL"] && smaS> smaL ){
			openLongPosition(respair, close);
		//open short position if conditions are met
		} else if(pairs[respair]["prevValues"]["smaS"] >pairs[respair]["prevValues"]["smaL"] && smaS < smaL){
			openShortPosition(respair, close);
		}
	}else if(pairs[respair]["long"]){
		//close long position at profit
		if(smaS < smaL && pairs[respair]["entryPrice"]*1.005 < close){
			success++;
			closeLongPosition(respair, close);
		// fix losses
		}else if(close < pairs[respair]["stopLossPrice"]){
			loss++;
			closeLongPosition(respair, close);
		}
	}else if(pairs[respair]["short"]){
		//close short position at profit
		if(smaS > smaL && pairs[respair]["entryPrice"] > close*1.005){
			success++;
			closeShortPosition(respair, close);
		//fix losses
		}else if(close > pairs[respair]["stopLossPrice"]){
			loss++;
			closeShortPosition(respair, close);
		}
	}

	pairs[respair]["prevValues"]["smaS"]=smaS;
	pairs[respair]["prevValues"]["smaL"]=smaL;

}

function openLongPosition(respair, close){
	pairs[respair]["entryAmount"] = getPositionSize(close) //temp
					
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
		if(backtest){
			pairs[respair]["stopLossPrice"] = close*(1-stopLossCoeff*pairsList.length);
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			pairs[respair]["long"] = true;
								
		}else{
			bfx.updateBalance(function(){
				pairs[respair]["stopLossPrice"] = close*(1-stopLossCoeff*pairsList.length);
				pairs[respair]["entryPrice"] = close;
				console.tag("Result").log("Opened long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
				console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
				pairs[respair]["long"] = true;
									
			});
		}
						
	});
	openedPositions++;

}

function openShortPosition(respair,close){
	pairs[respair]["entryAmount"] = getPositionSize(close) //temp
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
		if(backtest){
			pairs[respair]["stopLossPrice"] = close*(1+stopLossCoeff*pairsList.length);
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			pairs[respair]["short"] = true;
								
		}else{
			bfx.updateBalance(function(){
				pairs[respair]["stopLossPrice"] = close*(1+stopLossCoeff*pairsList.length);
				pairs[respair]["entryPrice"] = close;
				console.tag("Result").log("Opened short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
				console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
				pairs[respair]["short"] = true;
									
			});
		}
	});
	openedPositions++;
}

function closeLongPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
		if(backtest){
			console.tag("Result").log("Closed long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Result amount " +bfx.initAmout);
			console.tag("Result").log("Success " +success+" Loss "+loss);
			pairs[respair]["long"] = false;
			pairs[respair]["entryPrice"] = 0;
			pairs[respair]["entryAmount"] = 0; //temp
			pairs[respair]["stopLossPrice"]=0
		}else{
			bfx.updateBalance(function(){
				console.tag("Result").log("Closed long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
				console.tag("Result").log("Result amount " +bfx.initAmout);
				console.tag("Result").log("Success " +success+" Loss "+loss);
				pairs[respair]["long"] = false
				pairs[respair]["entryPrice"] = 0;
				pairs[respair]["entryAmount"] = 0;//temp
				pairs[respair]["stopLossPrice"]=0;
								
			});	
		}
						
	});
	openedPositions--;
}

function closeShortPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
		if(backtest){
			console.tag("Result").log("Closed short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Result amount " +bfx.initAmout);
			console.tag("Result").log("Success " +success+" Loss "+loss);
			pairs[respair]["short"] = false;
			pairs[respair]["entryPrice"] = 0;
			pairs[respair]["entryAmount"] = 0; //temp
			pairs[respair]["stopLossPrice"]=0
		}else{
			bfx.updateBalance(function(){
				console.tag("Result").log("Closed short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
				console.tag("Result").log("Result amount " +bfx.initAmout);
				console.tag("Result").log("Success " +success+" Loss "+loss);
				pairs[respair]["short"] = false
				pairs[respair]["entryPrice"] = 0;
				pairs[respair]["entryAmount"] = 0;//temp
				pairs[respair]["stopLossPrice"]=0;
								
			});	
		}
						
	});
	openedPositions--;
}

function getPositionSize(close){
	return bfx.initAmout/((pairsList.length-openedPositions)*close);

}


module.exports = Manager;