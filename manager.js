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
const pairsList=["XMRBTC", "ETHBTC", "ZECBTC", "LTCBTC", "ETCBTC", "DSHBTC", "XRPBTC"];

const pairsLimits={"XMRBTC" :0.1,
					"ETHBTC":0.01,
					"ZECBTC":0.01,
					"LTCBTC":0.1,
					"ETCBTC":0.1,
					"DSHBTC":0.01,
					"XRPBTC":10};

var pairs = {}
var prevValues={};

const backtest = false;
const period = 1800*1000;
const stopLossCoeff = 0.017;
const tradeCoeff = 1;


const trendStrength = 15;
const longSMA = 100;
const shortSMA = 10;
const adxPeriods =14;

//max number of simultaneously opened positions
var maxOpenedPosistions=5; 
//actual number of simultaneously opened positions
var openedPositions=0;
// number of profitable trades
var success =0;
//// number of lost trades
var loss=0;

var hpr =[];
var avgTotalHpr = 1;

function Manager(){
	
	this.runBlock = true;
	console.log("Initializing list of pairs ");
	//reduce maxOpenedPosistions only for backtesting
	if(backtest){
		maxOpenedPosistions=1;
	}
	
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
			entryAmount : 0, //temporary param
			positionCoeff:1,
			success: 0,
			loss:0,
			hpr:[],
			avgHpr:1

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
			var delay = period - Date.now() % period;
			console.log("Start in "+delay/60000+" minutes");
			setTimeout(function(){
				console.log("Bot is working");
				setInterval(function(){
					if(!self.runBlock){
						for(var pair in pairs){
							bfx.getTicker(pair, function(respair, data){
								analyzeData(self, respair,data);
							});
						}
					}
				}, period);

			}, delay);
			
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

	if(adx != undefined && 
		adx["adx"] > trendStrength && 
		!pairs[respair]["long"]&& 
		!pairs[respair]["short"] &&
		openedPositions<maxOpenedPosistions){
		//open long position if conditions are met
		if(pairs[respair]["prevValues"]["smaS"] <pairs[respair]["prevValues"]["smaL"] && smaS> smaL ){
			openLongPosition(respair, close);
		//open short position if conditions are met
		} else if(pairs[respair]["prevValues"]["smaS"] >pairs[respair]["prevValues"]["smaL"] && smaS < smaL){
			openShortPosition(respair, close);
		}
	}else if(pairs[respair]["long"]){
		//close long position at profit
		if(smaS < smaL && pairs[respair]["entryPrice"]*1.01 < close){
			success++; //total
			pairs[respair]["success"]++; //per pair
			closeLongPosition(respair, close);
		// fix losses
		}else if(close < pairs[respair]["stopLossPrice"]){
			loss++; //total
			pairs[respair]["loss"]++; //per pair
			closeLongPosition(respair, pairs[respair]["stopLossPrice"]);
		}
	}else if(pairs[respair]["short"]){
		//close short position at profit
		if(smaS > smaL && pairs[respair]["entryPrice"] > close*1.01){
			success++; //total
			pairs[respair]["success"]++; //per pair
			closeShortPosition(respair, close);
		//fix losses
		}else if(close > pairs[respair]["stopLossPrice"]){
			loss++; //total
			pairs[respair]["loss"]++; //per pair
			closeShortPosition(respair, pairs[respair]["stopLossPrice"]);
		}
	}

	pairs[respair]["prevValues"]["smaS"]=smaS;
	pairs[respair]["prevValues"]["smaL"]=smaL;

}

function openLongPosition(respair, close){
	pairs[respair]["entryAmount"] = getPositionSize(respair, close) //temp
	if(pairs[respair]["entryAmount"] >0){	
		bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
			
			pairs[respair]["stopLossPrice"] = close*(1-stopLossCoeff*maxOpenedPosistions);
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			console.tag("Result").log("----------------------------------------------------");
			pairs[respair]["long"] = true;
							
		});
		openedPositions++;
	}

}

function openShortPosition(respair,close){
	pairs[respair]["entryAmount"] = getPositionSize(respair, close) //temp
	if(pairs[respair]["entryAmount"] >0){
		bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
			
			pairs[respair]["stopLossPrice"] = close*(1+stopLossCoeff*maxOpenedPosistions);
			pairs[respair]["entryPrice"] = close;
			console.tag("Result").log("Opened short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
			console.tag("Result").log("Stop loss price " +pairs[respair]["stopLossPrice"]);
			console.tag("Result").log("----------------------------------------------------");

			pairs[respair]["short"] = true;
			
		});
		openedPositions++;
	}
}

function closeLongPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "sell", function(){
		
		hpr.push(close/pairs[respair]["entryPrice"]);
		for (var elem of hpr){
			avgTotalHpr=avgTotalHpr*elem;
		}
		avgTotalHpr = Math.pow(avgTotalHpr,1/hpr.length);

		pairs[respair]["hpr"].push(close/pairs[respair]["entryPrice"]);
		for (var elem of pairs[respair]["hpr"]){
			pairs[respair]["avgHpr"]=pairs[respair]["avgHpr"]*elem;
		}
		pairs[respair]["avgHpr"] = Math.pow(pairs[respair]["avgHpr"],1/pairs[respair]["hpr"].length);


		console.tag("Result").log("Closed long "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
		console.tag("Result").log("Result amount " +bfx.initAmout);
		console.tag("Result").log("Total success " +success+" Loss "+loss);
		console.tag("Result").log(respair+" success " +success+" Loss "+loss);
		console.tag("Result").log("Average total HPR " +avgTotalHpr);
		console.tag("Result").log("Average HPR for "+respair+" is " +pairs[respair]["avgHpr"]);

		console.tag("Result").log("----------------------------------------------------");

		pairs[respair]["long"] = false;
		pairs[respair]["entryPrice"] = 0;
		pairs[respair]["entryAmount"] = 0; //temp
		pairs[respair]["stopLossPrice"]=0
		
						
	});
	openedPositions--;
}

function closeShortPosition(respair, close){
	bfx.testTrade(respair, close, pairs[respair]["entryAmount"], "buy", function(){
		
		hpr.push(pairs[respair]["entryPrice"]/close);
		for (var elem of hpr){
			avgTotalHpr=avgTotalHpr*elem;
		}
		avgTotalHpr = Math.pow(avgTotalHpr,1/hpr.length);

		pairs[respair]["hpr"].push(pairs[respair]["entryPrice"]/close);
		for (var elem of pairs[respair]["hpr"]){
			pairs[respair]["avgHpr"]=pairs[respair]["avgHpr"]*elem;
		}
		pairs[respair]["avgHpr"] = Math.pow(pairs[respair]["avgHpr"],1/pairs[respair]["hpr"].length);


		console.tag("Result").log("Closed short "+respair+" " +pairs[respair]["entryAmount"]+" at "+ close);
		console.tag("Result").log("Result amount " +bfx.initAmout);
		console.tag("Result").log("Total success " +success+" Loss "+loss);
		console.tag("Result").log(respair+" success " +success+" Loss "+loss);
		console.tag("Result").log("Average total HPR " +avgTotalHpr);
		console.tag("Result").log("Average HPR for "+respair+" is " +pairs[respair]["avgHpr"]);

		console.tag("Result").log("----------------------------------------------------");
	
		pairs[respair]["short"] = false;
		pairs[respair]["entryPrice"] = 0;
		pairs[respair]["entryAmount"] = 0; //temp
		pairs[respair]["stopLossPrice"]=0
		
						
	});
	openedPositions--;
}

function getPositionSize(respair, close){

	if(pairs[respair]["hpr"].length %10 ==0){
		if(pairs[respair]["avgHpr"]<1){
			if(pairs[respair]["positionCoeff"] >0.1){
				pairs[respair]["positionCoeff"]=pairs[respair]["positionCoeff"]-0.1;
				console.tag("Result").log("Position coeff reduced "+pairs[respair]["positionCoeff"] );
			}

		}else{
			if(pairs[respair]["positionCoeff"] < 1){
				pairs[respair]["positionCoeff"]=pairs[respair]["positionCoeff"]+0.1;
				console.tag("Result").log("Position coeff uplifted "+pairs[respair]["positionCoeff"] );

			}

		}
	}

	var positionSize = pairs[respair]["positionCoeff"]*bfx.initAmout/((maxOpenedPosistions-openedPositions)*close);
	if(positionSize > pairsLimits[respair]){
		return positionSize;
	}else{
		console.tag("Result").log(respair+" Order is too small " +positionSize);
		return -1;
	}
	
	
}




module.exports = Manager;